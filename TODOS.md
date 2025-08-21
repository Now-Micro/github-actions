- demo/linting (finish):
    - namesspace standard
    - figure out how to inject  <ItemGroup>
    <ProjectReference
      Include="..\..\${{ inputs.code-analyzers-name }}$\Demo.Analyzers\Demo.Analyzers.csproj"
      OutputItemType="Analyzer"
      ReferenceOutputAssembly="false"
    />
  </ItemGroup>
    - address # Todo: change when done in demo-coding-standards.yml

- make sure that CSharpier adheres to standards [here](https://github.com/Now-Micro/CodeBits/blob/main/.github/copilot-instructions.md)
- publish the newest from actions repo as v1 (regarding the get-unique-directories changes).  
    - test the new changes in code bits for #64 and #57
- what is the best way to handle view/node linting?
- document assumptions around linting (certain files have to be present) in a readme.md file in the action directory