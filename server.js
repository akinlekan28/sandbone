require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dns = require("dns");
const { MongoClient } = require("mongodb");
const { nanoid } = require("nanoid");
const databaseUrl = process.env.DATABASE;

const app = express();
app.use(express.json());
app.use(cors());

app.post("/", (req, res) => {
  let url = req.body.url;
  if (!url) {
    return res.status(404).send({ status: "error", message: "url not found" });
  }
  try {
    url = new URL(url);
  } catch (err) {
    return res.status(400).send({ status: "error", message: "invalid URL" });
  }
  dns.lookup(url.hostname, (err) => {
    if (err) {
      return res
        .status(404)
        .send({ status: "error", message: "Address not found" });
    }
  });

  const { db } = req.app.locals;
  shortenUrl(db, url)
    .then((result) => {
      const { originalUrl, shortId } = result.value;
      res.status(200).send({
        status: "success",
        message: "Url shortened",
        data: { originalUrl, shortId },
      });
    })
    .catch((error) =>
      res
        .status(401)
        .send({ status: "error", message: "Something went wrong!", error })
    );
});

app.get("/:shortId", (req, res) => {
  const shortId = req.params.shortId;
  const { db } = req.app.locals;
  checkIfUrlExist(db, shortId)
    .then((result) => {
      if (result === null) {
        return res.status(404).send("Url not found");
      }
      res.redirect(result.originalUrl.href);
    })
    .catch(() => res.status(401).send("Something went wrong"));
});

const shortenUrl = (db, url) => {
  const shortenedUrl = db.collection("shortenedUrl");
  return shortenedUrl.findOneAndUpdate(
    { originalUrl: url },
    {
      $setOnInsert: {
        originalUrl: url,
        shortId: nanoid(6),
      },
    },
    {
      returnOriginal: false,
      upsert: true,
    }
  );
};

const checkIfUrlExist = (db, shortId) =>
  db.collection("shortenedUrl").findOne({ shortId });

MongoClient.connect(databaseUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then((client) => {
    app.locals.db = client.db("urlshortner");
    console.log("Database Connected");
  })
  .catch(() => console.log("Error connecting to the database"));

app.set("port", process.env.PORT || 4100);
const server = app.listen(app.get("port"), () => {
  console.log(`Express running → PORT ${server.address().port}`);
});
