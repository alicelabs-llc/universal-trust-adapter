// UTA — Kotlin example: verify a credential via public HTTP API (Ktor).
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

fun main(args: Array<String>) = runBlocking {
    val card = if (args.isNotEmpty()) args[0] else error("Usage: verify <card>")
    val client = HttpClient()
    val response: HttpResponse = client.post("https://www.marketnow.site/api/trust") {
        parameter("action", "verify")
        contentType(ContentType.Application.Json)
        setBody("""{"card":"$card"}""")
    }
    val body: String = response.body()
    val json = Json.parseToJsonElement(body).jsonObject
    println("Decision:   ${json["decision"]?.jsonPrimitive()?.content}")
    println("Format:     ${json["detected_format"]?.jsonPrimitive()?.content}")
    println("Issuer:     ${json["issuer"]?.jsonPrimitive()?.content}")
    client.close()
}
