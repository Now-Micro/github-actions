using System;
using System.Threading.Tasks;

// Should trigger a warning: Consider using parallel execution to improve performance (essentially no awaiting inside a loop)
// var tasks = customerIds.Select(id => GetCustomerAsync(id));
// var results = await Task.WhenAll(tasks);
namespace Demo.Linting
{
    public class LintingExamples
    {
        public async Task SequentialExecution()
        {
            var results = new List<string>();
            foreach (var id in customerIds)
            {
                var result = await GetCustomerAsync(id); // Each call waits for the previous one
                results.Add(result);
                if (result == null)
                    throw new Exception("Customer not found");
            }
        }
    }
}
