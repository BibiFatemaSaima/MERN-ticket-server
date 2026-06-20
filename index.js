require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
// CORS FIX/ middleware
app.use(cors());
//normal get
app.use(express.json());
app.get("/", (req, res) => {
  res.send("server is running");
});
// STRIPE
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//MongoDB
const { MongoClient, ServerApiVersion,ObjectId } = require("mongodb");
const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.za28cg0.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    //create database
    const db = client.db("online-Ticket");
    const ticketsCollection = db.collection("tickets");
    // Vendor Requested bookings db collections
    const bookingsCollection = db.collection("bookings");
    // users collections
    const usersCollection = db.collection("users");
// CREATE / UPDATE USER (UPSERT)
app.post("/users", async (req, res) => {
  try {
    const user = req.body;

    const filter = { email: user.email };

    const options = { upsert: true };

    const updateDoc = {
      $set: user,
    };

    const result = await usersCollection.updateOne(
      filter,
      updateDoc,
      options
    );

    res.send(result);
  } catch (error) {
    console.log("USER SAVE ERROR:", error);
    res.status(500).send({ error: "User save failed" });
  }
});
    // Manage Users
    app.get("/users", async (req, res) => {

    const result = await usersCollection.find().toArray();

    res.send(result);

    });
    // single booking fetch (Payment page এর জন্য)
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await bookingsCollection.findOne(query);

      res.send(result);
    });
    // post api
    app.post("/tickets", async (req, res) => {
      const newTicket = req.body;
      const result = await ticketsCollection.insertOne(newTicket);
      res.send(result);
    });
    // get api
    app.get("/tickets", async (req, res) => {
      const result = await ticketsCollection.find().toArray();
      res.send(result);
    });
    // single ticket fetch
    app.get("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ticketsCollection.findOne(query);
      res.send(result);
    });
    //My added tickets
    app.get("/tickets/vendor/:email", async (req, res) => {
      const email = req.params.email;

      const query = { vendorEmail: email };

      const result = await ticketsCollection.find(query).toArray();

      res.send(result);
    });
    //my tickets
    app.get("/myTickets/:email", async (req, res) => {
      const email = req.params.email;

      const query = { vendorEmail: email };

      const result = await ticketsCollection.find(query).toArray();

      res.send(result);
    });
    // delete api
    app.delete("/tickets/:id", async (req, res) => {
      const id = req.params.id;

      const result = await ticketsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });
    // update tickets

    app.put("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: updatedData,
      };
      const result = await ticketsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
// Vendor requested bookings GET API
app.get("/requestedBookings/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const result = await bookingsCollection
      .find({
        vendorEmail: email,
      })
      .toArray();

    res.send(result);
  } catch (err) {
    console.error("Requested bookings error:", err);
    res.status(500).send([]);
  }
});
app.post("/bookings", async (req, res) => {
  try {
    const booking = req.body;

    const result = await bookingsCollection.insertOne(booking);

    console.log("✔ INSERTED IN DB:", result.insertedId);
    console.log("✔ DB NAME:", client.db().databaseName);

    res.send(result);
  } catch (error) {
    console.log("BOOKING ERROR:", error);
    res.status(500).send({ error: "Booking failed" });
  }
});
    // User's booked tickets
app.get("/bookings/:email", async (req, res) => {
  const email = req.params.email;

  const query = {
    buyerEmail: email,
  };

  const result = await bookingsCollection.find(query).toArray();

  res.send(result);
});
   // Get single user by email
app.get("/users/:email", async (req, res) => {
  const email = req.params.email.toLowerCase();

  const user = await usersCollection.findOne({
    email: email.toLowerCase(),
  });

  res.send(user);
}); 
// =========================
// CREATE PAYMENT INTENT
// =========================

app.post("/create-payment-intent", async (req, res) => {

  const { totalPrice } = req.body;

  const amount = parseInt(totalPrice * 100);

  const paymentIntent = await stripe.paymentIntents.create({

    amount,

    currency: "usd",

    payment_method_types: ["card"],

  });

  res.send({

    clientSecret: paymentIntent.client_secret,

  });

});
    app.patch("/bookings/payment/:id", async (req, res) => {

  const id = req.params.id;

  const paymentInfo = req.body;

  const query = {

    _id: new ObjectId(id),

  };

  const updateDoc = {

    $set: paymentInfo,

  };

  const result = await bookingsCollection.updateOne(

    query,

    updateDoc
  );

  res.send(result);

    });
    // Accept booking api
    app.patch("/bookings/accept/:id", async (req, res) => {
  const id = req.params.id;

  const result = await bookingsCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        bookingStatus: "accepted",
      },
    }
  );

  res.send(result);
    });
    // Reject booking api
    app.patch("/bookings/reject/:id", async (req, res) => {
  const id = req.params.id;

  const result = await bookingsCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        bookingStatus: "rejected",
      },
    }
  );

  res.send(result);
    });
    // Total Tickets Added
app.get("/vendor/totalTickets/:email", async (req, res) => {

  const email = req.params.email;

  const count = await ticketsCollection.countDocuments({
    vendorEmail: email,
  });

  res.send({ totalTickets: count });

});
    // Pending Requests
app.get("/vendor/pendingRequests/:email", async (req, res) => {

  const email = req.params.email;

  const count = await bookingsCollection.countDocuments({

    vendorEmail: email,

    bookingStatus: "pending",

  });

  res.send({

    pendingRequests: count,

  });

});
  // Accepted Bookings
app.get("/vendor/acceptedBookings/:email", async (req, res) => {

  const email = req.params.email;

  const count = await bookingsCollection.countDocuments({

    vendorEmail: email,

    bookingStatus: "accepted",

  });

  res.send({

    acceptedBookings: count,

  });

}); 
// Vendor Revenue (OPTIMIZED)
app.get("/vendor/revenue/:email", async (req, res) => {
  const email = req.params.email;

  const result = await bookingsCollection.aggregate([
    {
      $match: {
        vendorEmail: email,
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        revenue: {
          $sum: "$totalPrice",
        },
      },
    },
  ]).toArray();

  res.send({
    revenue: result[0]?.revenue || 0,
  });
});
// make admin 
    app.patch("/users/admin/:id", async (req, res) => {
  const id = req.params.id;

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { role: "admin" },
    }
  );

  res.send(result);
    });
    // Make Vendor
    app.patch("/users/vendor/:id", async (req, res) => {

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

});
    // make tickets for approved tickets api
    app.patch("/tickets/approve/:id", async (req, res) => {
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
    });
    // make tickets for reject tickets api
app.patch("/tickets/reject/:id", async (req, res) => {
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
});
    // advertise tickets api
    app.patch("/tickets/advertise/:id", async (req, res) => {
  const id = req.params.id;
  const { advertised } = req.body;

  const result = await ticketsCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        advertised: advertised,
      },
    }
  );

  res.send(result);
});
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`server is running on por: ${port}`);
});
