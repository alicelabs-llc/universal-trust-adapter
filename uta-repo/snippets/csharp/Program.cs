// UTA — C# example: verify a credential via public HTTP API (.NET 8).
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
using System.Text;
using System.Text.Json;

var card = args.Length > 0 ? args[0] : throw new ArgumentException("Usage: verify <card>");
var payload = JsonSerializer.Serialize(new { card });
var content = new StringContent(payload, Encoding.UTF8, "application/json");

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
var response = await http.PostAsync("https://www.marketnow.site/api/trust?action=verify", content);
var body = await response.Content.ReadAsStringAsync();

using var doc = JsonDocument.Parse(body);
var root = doc.RootElement;
Console.WriteLine($"Decision:   {root.GetProperty("decision").GetString()}");
if (root.TryGetProperty("detected_format", out var fmt))
    Console.WriteLine($"Format:     {fmt.GetString()}");
