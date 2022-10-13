import { MongoClient, ServerApiVersion } from "mongodb";
import { URI } from "../constants/envVars.js";

export const mongoClient = async () => {
  const uri = URI;
  try {
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    });
    await client.connect();
    return client;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
