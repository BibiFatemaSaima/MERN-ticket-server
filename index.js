require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

// =====================
// STRIPE
// =====================
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// =====================
// MONGO CONFIG
// =====================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.za28cg0.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// =====================
// GLOBAL COLLECTIONS
// =====================
let ticketsCollection;
let bookingsCollection;
let usersCollection;

// =====================
// DB CONNECT (SAFE)
// =====================
async function connectDB() {
  if (ticketsCollection) return;

  try {
    await client.connect();

    const db = client.db("online-Ticket");

    ticketsCollection = db.collection("tickets");
    bookingsCollection = db.collection("bookings");
    usersCollection = db.collection("users");

    console.log("MongoDB Connected");
  } catch (err) {
    console.log("DB ERROR:", err);
  }
}

// auto init
connectDB();

// =====================
// ROOT
// =====================
app.get("/", (req, res) => {
  res.send("Server is running");
});

// =====================
// USERS
// =====================
app.post("/users", async (req, res) => {
  try {
    await connectDB();

    const user = req.body;

    const result = await usersCollection.updateOne(
      { email: user.email },
      { $set: user },
      { upsert: true }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "User save failed" });
  }
});

app.get("/users", async (req, res) => {
  try {
    await connectDB();

    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Users fetch failed" });
  }
});

app.get("/users/:email", async (req, res) => {
  try {
    await connectDB();

    const email = req.params.email.toLowerCase();

    const user = await usersCollection.findOne({
      email: email,
    });

    res.send(user);
  } catch (err) {
    res.status(500).send({ error: "User fetch failed" });
  }
});

// =====================
// TICKETS
// =====================

// Get all tickets
app.get("/tickets", async (req, res) => {
  try {
    await connectDB();

    const result = await ticketsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Tickets fetch failed" });
  }
});

app.get("/tickets/:id", async (req, res) => {
  try {
    await connectDB();

    const id = req.params.id;

    const result = await ticketsCollection.findOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Ticket fetch failed" });
  }
});



// =====================
// BOOKINGS
// =====================
app.post("/bookings", async (req, res) => {
  try {
    await connectDB();

    const booking = {
      ...req.body,
      bookingStatus: "pending",
      paymentStatus: "unpaid",
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(booking);

    res.send(result);

  } catch (err) {
    res.status(500).send({ error: "Booking failed" });
  }
});

app.get("/bookings/:email", async (req, res) => {
  try {
    await connectDB();

    const result = await bookingsCollection
      .find({ buyerEmail: req.params.email })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send([]);
  }
});

// =====================
// PAYMENT
// =====================
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { totalPrice } = req.body;

    const amount = parseInt(totalPrice * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).send({ error: "Payment intent failed" });
  }
});
// Make admin
app.patch("/users/admin/:id", async (req, res) => {
  try {

    await connectDB();

    const id = req.params.id;

    const result = await usersCollection.updateOne(

      { _id: new ObjectId(id) },

      {
        $set: {
          role: "admin"
        }
      }

    );

    res.send(result);

  }

  catch (error) {

    console.log(error);

    res.status(500).send({
      error: "Failed to make admin"
    });

  }

});
// Make vendor
app.patch("/users/vendor/:id", async (req, res) => {

  try {

    await connectDB();

    const id = req.params.id;

    const result = await usersCollection.updateOne(

      { _id: new ObjectId(id) },

      {
        $set: {
          role: "vendor"
        }
      }

    );

    res.send(result);

  }

  catch (error) {

    console.log(error);

    res.status(500).send({
      error: "Failed to make vendor"
    });

  }

});
// Approved Tickets
app.patch("/tickets/approve/:id", async (req, res) => {
  try {
    await connectDB();

    const id = req.params.id;

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "approved",
        },
      }
    );

    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Approve failed" });
  }
});
// Reject Tickets
app.patch("/tickets/reject/:id", async (req, res) => {
  try {
    await connectDB();

    const id = req.params.id;

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "rejected",
        },
      }
    );

    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Reject failed" });
  }
});
// Add ticket
app.post("/tickets", async (req, res) => {
  try {
    await connectDB();

    const {
      vendorEmail,
      vendorName,
      title,
      from,
      to,
      transportType,
      price,
      quantity,
      departureDate,
      departureTime,
      image,
      perks
    } = req.body;

    // 🔴 validation (important)
    if (!vendorEmail || !title || !from || !to) {
      return res.status(400).send({
        error: "Missing required fields"
      });
    }

    const ticket = {
      vendorEmail,
      vendorName,
      title,
      from,
      to,
      transportType,
      price: Number(price),
      quantity: Number(quantity),
      departureDate,
      departureTime,
      image,
      perks: Array.isArray(perks) ? perks : [],
      status: "pending",
      advertised: false,
      createdAt: new Date()
    };

    const result = await ticketsCollection.insertOne(ticket);

    res.send({
      success: true,
      insertedId: result.insertedId
    });

  } catch (err) {
    console.log("ADD TICKET ERROR:", err);
    res.status(500).send({ error: "Ticket create failed" });
  }
});
// My added tickets
app.get("/tickets/vendor/:email", async (req, res) => {
  try {
    await connectDB();

    const email = req.params.email;

    const result = await ticketsCollection
      .find({ vendorEmail: email })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Fetch failed" });
  }
});
// Delete tickets
app.delete("/tickets/:id", async (req, res) => {
  try {
    await connectDB();

    const id = req.params.id;

    const result = await ticketsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Delete failed" });
  }
});
// Update tickets
app.put("/tickets/:id", async (req, res) => {
  try {
    await connectDB();

    const id = req.params.id;

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Update failed" });
  }
});
// Requested bookings
app.get("/requestedBookings/:email", async (req, res) => {
  try {
    await connectDB();

    const email = req.params.email;

    const result = await bookingsCollection
      .find({ vendorEmail: email })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Fetch failed" });
  }
});
// accepted bookings
app.patch("/bookings/accept/:id", async (req, res) => {
  try {
    await connectDB();

    const id = req.params.id;

    const result = await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { bookingStatus: "accepted" } }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Accept failed" });
  }
});
// Rejected bookings
app.patch("/bookings/reject/:id", async (req, res) => {
  try {
    await connectDB();

    const id = req.params.id;

    const result = await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { bookingStatus: "rejected" } }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Reject failed" });
  }
});
// Revenue overview
app.get("/vendor/revenue/:email", async (req, res) => {
  try {
    await connectDB();

    const email = req.params.email;

    const bookings = await bookingsCollection
      .find({ vendorEmail: email })
      .toArray();

    const totalRevenue = bookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    const acceptedBookings = bookings.filter(b => b.bookingStatus === "accepted").length;

    const pendingRequests = bookings.filter(b => b.bookingStatus === "pending").length;

    const totalTicketsSold = bookings.filter(b => b.paymentStatus === "paid").length;

    res.send({
      totalRevenue,
      acceptedBookings,
      pendingRequests,
      totalTicketsSold
    });

  } catch (err) {
    res.status(500).send({ error: "Revenue failed" });
  }
});

// =====================
// EXPORT FOR VERCEL
// =====================
module.exports = app;