When being asked to create demo workflows, keep these things in mind:
    - Each workflow should run like a test suite.  The names of the steps should represent test names and there should be assertions which cause the workflow to stop if not met.
    - Each workflow must have a summary section which prints out all of the tests, their assertions, and the result
    - Use .testing/assert/action.yml action when making assertions
    - Make sure to follow the pattern established in ./github/actions/demo-get-project-and-solution-files-from-directory whereby each demo workflow file is really just using a composite action.  
    - Make sure to create a new job in `demo-all.yml` using the new composite action