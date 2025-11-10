import { createClient } from "genlayer-js"
import { studionet } from "genlayer-js/chains"

class ProofOfArgentineanExperience {
  contractAddress: string
  client: any

  constructor(contractAddress: string, account: any = null) {
    this.contractAddress = contractAddress

    const config: any = {
      chain: studionet,
      endpoint: "https://devconnect-25-studio.genlayer.com/api",
      ...(account ? { account } : {}),
    }

    this.client = createClient(config)
  }

  updateAccount(account: any) {
    this.client = createClient({
      chain: studionet,
      endpoint: "https://devconnect-25-studio.genlayer.com/api",
      account,
    })
  }

  async evaluate(description: string, tags: string[] | null = null) {
    const result = await this.client.readContract({
      address: this.contractAddress,
      functionName: "evaluate",
      args: tags ? [description, tags] : [description],
    })

    // Convertir el resultado de Map a objeto si es necesario
    if (result instanceof Map) {
      return {
        score: Number(result.get("score")),
        message: result.get("message"),
      }
    }

    // Si es un objeto directo
    if (result && typeof result === "object") {
      return {
        score: Number(result.score || result.get?.("score") || 0),
        message: result.message || result.get?.("message") || "",
      }
    }

    return {
      score: Number(result?.score || 0),
      message: result?.message || "",
    }
  }
}

export default ProofOfArgentineanExperience
