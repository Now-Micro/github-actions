using System.Collections.Immutable;
using System.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Diagnostics;

namespace Demo.Analyzers;

[DiagnosticAnalyzer(LanguageNames.CSharp)]
public sealed class DisallowStringConcatAnalyzer : DiagnosticAnalyzer
{
    public const string DiagnosticId = "DA0002"; // Distinct from DA0001

    private static readonly LocalizableString Title =
        "Disallow string concatenation / string.Format in logging";
    private static readonly LocalizableString MessageFormat =
        "Avoid string concatenation or string.Format; use string interpolation";
    private static readonly LocalizableString Description =
        "Enforces use of C# string interpolation instead of string concatenation or string.Format in Logger.LogDebug calls.";
    private const string Category = "Style";

    private static readonly DiagnosticDescriptor Rule = new(
        DiagnosticId,
        Title,
        MessageFormat,
        Category,
        DiagnosticSeverity.Error,
        isEnabledByDefault: true,
        description: Description
    );

    public override ImmutableArray<DiagnosticDescriptor> SupportedDiagnostics =>
        ImmutableArray.Create(Rule);

    public override void Initialize(AnalysisContext context)
    {
        context.ConfigureGeneratedCodeAnalysis(GeneratedCodeAnalysisFlags.None);
        context.EnableConcurrentExecution();
        context.RegisterSyntaxNodeAction(AnalyzeInvocation, SyntaxKind.InvocationExpression);
    }

    private static void AnalyzeInvocation(SyntaxNodeAnalysisContext context)
    {
        if (context.Node is not InvocationExpressionSyntax invocation)
            return;
        if (invocation.Expression is not MemberAccessExpressionSyntax memberAccess)
            return;
        if (memberAccess.Name.Identifier.Text != "LogDebug")
            return;

        // Basic method name match; semantic check to ensure it's Logger.LogDebug (optional)
        var symbol = context.SemanticModel.GetSymbolInfo(memberAccess).Symbol as IMethodSymbol;
        if (symbol == null)
            return;
        if (symbol.Name != "LogDebug")
            return;

        foreach (var arg in invocation.ArgumentList.Arguments)
        {
            var expr = arg.Expression;
            if (expr is BinaryExpressionSyntax binary && binary.IsKind(SyntaxKind.AddExpression))
            {
                // If either side is or produces a string, flag
                var leftType = context.SemanticModel.GetTypeInfo(binary.Left).ConvertedType;
                var rightType = context.SemanticModel.GetTypeInfo(binary.Right).ConvertedType;
                if (
                    leftType?.SpecialType == SpecialType.System_String
                    || rightType?.SpecialType == SpecialType.System_String
                )
                {
                    context.ReportDiagnostic(Diagnostic.Create(Rule, binary.GetLocation()));
                }
            }
            else if (
                expr is InvocationExpressionSyntax innerInv
                && innerInv.Expression is MemberAccessExpressionSyntax innerMa
            )
            {
                // Detect string.Format(...)
                if (
                    innerMa.Expression is IdentifierNameSyntax ident
                    && ident.Identifier.Text == "string"
                    && innerMa.Name.Identifier.Text == "Format"
                )
                {
                    context.ReportDiagnostic(Diagnostic.Create(Rule, innerInv.GetLocation()));
                }
            }
        }
    }
}
