When being asked to create demo workflows, keep these things in mind:
    - Each workflow should run like a test suite.  The names of the steps should represent test names and there should be assertions which cause the workflow to stop if not met.
    - Each workflow must have a summary section which prints out all of the tests, their assertions, and the result