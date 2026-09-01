// UTA — Java example: verify a credential via public HTTP API (JDK 11+).
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class Verify {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) { System.err.println("Usage: java Verify <card>"); System.exit(1); }
        String card = args[0];
        String payload = String.format("{\"card\":\"%s\"}", card);
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("https://www.marketnow.site/api/trust?action=verify"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();
        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        System.out.println(resp.body());
    }
}
