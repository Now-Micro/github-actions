namespace Demo.Linting
{
    public class CodingStandards
    {
        // Should trigger a warning: Consider using parallel execution to improve performance (essentially no awaiting inside a loop)
        public async Task SequentialExecution(IEnumerable<int> customerIds)
        {
            // ✅ Correct - String interpolation
            Logger.LogDebug($"Processing request for customer {customerId}");

            // ❌ Incorrect - String concatenation or format
            Logger.LogDebug("Processing request for customer " + customerId);
            Logger.LogDebug(string.Format("Processing request for customer {0}", customerId));

            // ✅ Correct - Curly braces on if statements
            if (string.IsNullOrEmpty(customerId))
            {
                throw new ArgumentException(
                    "Customer ID cannot be null or empty.",
                    nameof(customerId)
                );
            }

            // ❌ Incorrect - Missing curly braces
            if (string.IsNullOrEmpty(customerId))
                throw new ArgumentException(
                    "Customer ID cannot be null or empty.",
                    nameof(customerId)
                );
        }
    }
}
