using System.Collections.Generic;
using System.Threading.Tasks;

namespace Demo.Linting;

public class LintingExamples
{
    private readonly List<int> _customerIds = new() { 1, 2, 3 };

    private async Task<string> GetCustomerAsync(int id)
    {
        await Task.Delay(10); // Simulate I/O
        return id.ToString();
    }

    // Intentionally sequential to allow analyzer to flag pattern (await inside loop)
    public async Task SequentialExecution()
    {
        var results = new List<string>();
        foreach (var id in _customerIds)
        {
            var result = await GetCustomerAsync(id); // Sequential await
            results.Add(result);
        }
    }
}
