// UTA — Swift example: verify a credential via public HTTP API.
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
import Foundation

let card = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
let url = URL(string: "https://www.marketnow.site/api/trust?action=verify")!
var req = URLRequest(url: url)
req.httpMethod = "POST"
req.setValue("application/json", forHTTPHeaderField: "Content-Type")
req.httpBody = try? JSONSerialization.data(withJSONObject: ["card": card])

let semaphore = DispatchSemaphore(value: 0)
URLSession.shared.dataTask(with: req) { data, _, _ in
    if let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        print("Decision:   \(json["decision"] ?? "?")")
        print("Format:     \(json["detected_format"] ?? "?")")
        print("Issuer:     \(json["issuer"] ?? "?")")
    }
    semaphore.signal()
}.resume()
semaphore.wait()
