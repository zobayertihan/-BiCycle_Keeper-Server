const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ilc8iz8.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}


async function run() {
    try {
        const usersCollection = client.db('bicycleKeeper').collection('users');
        const productsCollection = client.db('bicycleKeeper').collection('products');
        const catagoryCollection = client.db('bicycleKeeper').collection('catagories');
        const ordersCollection = client.db('bicycleKeeper').collection('orders');

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '10h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.post('/products', verifyJWT, async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        });

        app.get('/catagories', async (req, res) => {
            const query = {};
            const result = await catagoryCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        })

        app.get('/users/allseller', async (req, res) => {
            const email = req.params.email;
            const query = { role: 'seller' }
            const user = await usersCollection.find(query).toArray();
            res.send(user);
        })

        app.get('/users/allbuyer', async (req, res) => {
            const email = req.params.email;
            const query = { role: 'buyer' }
            const user = await usersCollection.find(query).toArray();
            res.send(user);
        })

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const result = await usersCollection.updateOne({ _id: ObjectId(id) }, { $set: req.body })
            res.send(result);
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = await usersCollection.find({ email: email }).toArray();
            res.send(query)
        })

        app.get('/products/:email', async (req, res) => {
            const email = req.params.email
            const query = await productsCollection.find({}).toArray();
            const filterData = query.filter(p => p.sellerEmail === email)
            if (filterData) {
                res.send({
                    success: true,
                    data: filterData
                })
            }
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        app.get(`/catagory/:catagory`, async (req, res) => {
            const catagory = req.params.catagory;
            const result = await productsCollection.find({}).toArray();
            const filterData = result.filter(p => p.catagory === catagory)
            if (filterData) {
                res.send({
                    success: true,
                    data: filterData
                })
            }

        })


        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order);
            res.send(result);
        })

        // app.get('/orders/:email', verifyJWT, async (req, res) => {
        //     const email = req.params.email
        //     const result = await ordersCollection.find({}).toArray();
        //     const filterData = result.filter(o => o.email === email)
        //     if (filterData) {
        //         res.send({
        //             success: true,
        //             data: filterData
        //         })
        //     }
        // })
        app.get('/orders/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const result = await ordersCollection.find().toArray();
            const filterData = result.filter(p => p.email === email);
            res.send(filterData);
        });

        app.delete('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        };

        app.put('/users/seller/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: 'Veryfied'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('BiCycle Keeper server is running');
})

app.listen(port, () => console.log(`BiCycle Keeper running on ${port}`))