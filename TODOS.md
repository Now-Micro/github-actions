- refactor nuget/configure-source
  -- allow it configure multiples sources in one step (i.e. use comma-separated values for each input)
    --- need to first validate things
    --- add tests
    --- needs to support existing implementation of only one value
    --- refactor the usage in dotnet/coding-standards

- handle todo comments (search for 'todo:')
- need to test that nuget/nuget-source and any other action that has changed in this branch

- make sure that CSharpier adheres to standards [here](https://github.com/Now-Micro/CodeBits/blob/main/.github/copilot-instructions.md)
- publish the newest from actions repo as v1 (regarding the get-unique-directories changes).  
    - test the new changes in code bits for #64 and #57
- what is the best way to handle view/node linting?
- document assumptions around linting (certain files have to be present) in a readme.md file in the action directory