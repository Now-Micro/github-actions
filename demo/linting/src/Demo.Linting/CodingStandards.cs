using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Demo.Linting;

public class CodingStandards
{
    // Demonstrates style rules (string interpolation preferred, braces required)
    public async Task SequentialExecutionAsync(IEnumerable<int> customerIds)
    {
        foreach (var customerId in customerIds)
        {
            // Preferred interpolation
            Logger.LogDebug($"Processing request for customer {customerId}");

            // Non‑preferred forms (left commented for illustrative purposes)
            // Logger.LogDebug("Processing request for customer " + customerId);
            // Logger.LogDebug(string.Format("Processing request for customer {0}", customerId));

            if (customerId < 0)
            {
                throw new ArgumentException("Customer ID cannot be negative.");
            }

            await Task.Delay(1).ConfigureAwait(false);
        }
    }
}
