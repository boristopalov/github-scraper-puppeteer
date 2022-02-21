import { MongoClient, ServerApiVersion } from "mongodb";

const main = async () => {
  const uri =
    "mongodb+srv://comm:comm@ghscraper.eyaht.mongodb.net/GHScraper?retryWrites=true&w=majority";
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
  });
  client.connect((err) => {
    const collection = client.db("test").collection("devices");
    // perform actions on the collection object
    client.close();
  });
};

export const createUserListing = async (client, listing) => {
  const res = await client.db("scraper").collection("users").insertOne(listing);
  console.log(
    `inserted ${res.insertedCount} new user listings with id ${res.insertedIds}`
  );
};

export const createManyUserListings = async (client, listings) => {
  const res = await client
    .db("scraper")
    .collection("users")
    .insertMany(listings);
  console.log(`new user listing created with id ${res.insertedId}`);
};

export const findUserByUsername = async (client, username) => {
  const res = await client
    .db("scraper")
    .collection("users")
    .findOne({ username: username });

  if (res) {
    console.log(`found user with username ${username}`);
  } else {
    console.log(`no user found with username ${username}`);
  }
};

main();
