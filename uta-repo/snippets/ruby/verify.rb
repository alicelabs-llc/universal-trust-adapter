#!/usr/bin/env ruby
# UTA — Ruby example: verify a credential via public HTTP API.
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
require 'net/http'
require 'uri'
require 'json'

card = ARGV[0] || abort('Usage: verify.rb <card-string>')
uri = URI('https://www.marketnow.site/api/trust?action=verify')
req = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json')
req.body = { card: card }.to_json

resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }
result = JSON.parse(resp.body)
puts "Decision:   #{result['decision']}"
puts "Format:     #{result['detected_format']}"
puts "Issuer:     #{result['issuer']}"
exit case result['decision']
     when 'PERMIT' then 0
     when 'DENY' then 1
     else 2
     end
