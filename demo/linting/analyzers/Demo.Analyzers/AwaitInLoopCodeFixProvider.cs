using System.Collections.Immutable;
using System.Composition;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CodeActions;
using Microsoft.CodeAnalysis.CodeFixes;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Demo.Analyzers;

[ExportCodeFixProvider(LanguageNames.CSharp, Name = nameof(AwaitInLoopCodeFixProvider)), Shared]
public class AwaitInLoopCodeFixProvider : CodeFixProvider
{
    public override ImmutableArray<string> FixableDiagnosticIds => ImmutableArray.Create(AwaitInLoopAnalyzer.DiagnosticId);

    public override FixAllProvider GetFixAllProvider() => WellKnownFixAllProviders.BatchFixer;

    public override async Task RegisterCodeFixesAsync(CodeFixContext context)
    {
        var diagnostic = context.Diagnostics.First();
        var root = await context.Document.GetSyntaxRootAsync(context.CancellationToken).ConfigureAwait(false);
        if (root == null) return;
        var awaitNode = root.FindNode(diagnostic.Location.SourceSpan) as AwaitExpressionSyntax;
        if (awaitNode == null) return;

        context.RegisterCodeFix(
            CodeAction.Create(
                title: "Convert to Task.WhenAll pattern",
                createChangedDocument: ct => ConvertToWhenAllAsync(context.Document, awaitNode, ct),
                equivalenceKey: "ConvertToWhenAll"),
            diagnostic);
    }

    private static async Task<Document> ConvertToWhenAllAsync(Document document, AwaitExpressionSyntax awaitNode, CancellationToken ct)
    {
        // Find the containing foreach statement
        var foreachStmt = awaitNode.FirstAncestorOrSelf<ForEachStatementSyntax>();
        if (foreachStmt == null) return document;

        // Heuristic: create tasks list variable name
        var semanticModel = await document.GetSemanticModelAsync(ct).ConfigureAwait(false);
        var idName = foreachStmt.Identifier.Text;
        var taskVar = SyntaxFactory.IdentifierName("tasks");

        // Build: var tasks = new List<Task<...>>(); before loop if not present (simplified to Task)
        var listDecl = SyntaxFactory.LocalDeclarationStatement(
            SyntaxFactory.VariableDeclaration(
                SyntaxFactory.IdentifierName("var"))
            .WithVariables(
                SyntaxFactory.SingletonSeparatedList(
                    SyntaxFactory.VariableDeclarator(taskVar.Identifier)
                        .WithInitializer(
                            SyntaxFactory.EqualsValueClause(
                                SyntaxFactory.ObjectCreationExpression(SyntaxFactory.IdentifierName("List<Task>"))
                                    .WithArgumentList(SyntaxFactory.ArgumentList()))))));

        // Replace await expr with adding task to list: tasks.Add(GetCustomerAsync(id));
        var invocation = awaitNode.Expression as InvocationExpressionSyntax;
        if (invocation == null) return document;
        var addCall = SyntaxFactory.ExpressionStatement(
            SyntaxFactory.InvocationExpression(
                SyntaxFactory.MemberAccessExpression(SyntaxKind.SimpleMemberAccessExpression, taskVar, SyntaxFactory.IdentifierName("Add")))
            .WithArgumentList(SyntaxFactory.ArgumentList(SyntaxFactory.SingletonSeparatedList(SyntaxFactory.Argument(invocation)))));

        var newForeachBody = foreachStmt.Statement as BlockSyntax ?? SyntaxFactory.Block(foreachStmt.Statement);
        newForeachBody = newForeachBody.ReplaceNode(awaitNode.Parent is ExpressionStatementSyntax es ? es : awaitNode, addCall);
        var newForeach = foreachStmt.WithStatement(newForeachBody);

        // After loop: await Task.WhenAll(tasks);
        var whenAll = SyntaxFactory.ExpressionStatement(
            SyntaxFactory.AwaitExpression(
                SyntaxFactory.InvocationExpression(
                    SyntaxFactory.MemberAccessExpression(SyntaxKind.SimpleMemberAccessExpression,
                        SyntaxFactory.IdentifierName("Task"), SyntaxFactory.IdentifierName("WhenAll")))
                .WithArgumentList(SyntaxFactory.ArgumentList(SyntaxFactory.SingletonSeparatedList(SyntaxFactory.Argument(taskVar))))));

        var root = await document.GetSyntaxRootAsync(ct).ConfigureAwait(false);
        if (root == null) return document;

        // Insert listDecl before foreach, and whenAll after
        var parentBlock = foreachStmt.Parent as BlockSyntax;
        if (parentBlock == null) return document;
        var statements = parentBlock.Statements;
        var foreachIndex = statements.IndexOf(foreachStmt);
        var updated = parentBlock.WithStatements(statements
            .Insert(foreachIndex, listDecl)
            .Replace(foreachStmt, newForeach)
            .Insert(foreachIndex + 2, whenAll));

        var newRoot = root.ReplaceNode(parentBlock, updated);
        return document.WithSyntaxRoot(newRoot);
    }
}
