using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Demo.Linting
{
    public class CodingStandards
    {
        // Demonstrates style rules (string interpolation preferred, braces required)
        public void SequentialExecution(IEnumerable<int> customerIds)
        {
            foreach (var customerId in customerIds)
            {
                // Preferred interpolation
                Logger.LogDebug($"This approach is desirable: {customerId}");

                // Non‑preferred forms (left commented for illustrative purposes)
                Logger.LogDebug("This should not be used: " + customerId);
                Logger.LogDebug(string.Format("This is also frowned upon {0}", customerId));

                if (customerId < 0)
                    throw new ArgumentException("Customer ID cannot be negative.");
            }
        }
    }
}
