# UTA — Elixir example: verify a credential via public HTTP API.
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
# Run: elixir verify.exs <card-string>
card = hd(System.argv())
payload = Jason.encode!(%{card: card})
response = HTTPoison.post!(
  "https://www.marketnow.site/api/trust?action=verify",
  payload,
  [{"Content-Type", "application/json"}],
  recv_timeout: 10_000
)
result = Jason.decode!(response.body)
IO.puts("Decision:   #{result["decision"]}")
IO.puts("Format:     #{result["detected_format"]}")
IO.puts("Issuer:     #{result["issuer"]}")
