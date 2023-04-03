const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const SSLCommerzPayment = require('sslcommerz-lts')

const app = express();
const port = process.env.PORT || 5000;

// SSL Commerz
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lxrpuhw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const serviceCollection = client.db("geniusCar").collection("service");
        const productCollection = client.db("geniusCar").collection("product");
        const orderCollection = client.db("geniusCar").collection("order");

        // Service Operation
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        app.get('/service/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const service = await serviceCollection.findOne(query);
            res.send(service);
        });



        // Product Operation
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        app.post('/productByKeys', async (req, res) => {
            const keys = req.body;
            const ids = keys.map(id => new ObjectId(id));
            const query = { _id: { $in: ids } }
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        })



        //Order & Payment Operation
        app.post('/order', async (req, res) => {
            const order = req.body;
            const { title, price, customer, email, address, phone, postcode, currency } = order;
            const transactionId = new ObjectId().toString();

            const data = {
                total_amount: price,
                currency: currency,
                tran_id: transactionId,
                success_url: `${process.env.SERVER_URL}/payment/success?transactionId=${transactionId}`,
                fail_url: `${process.env.SERVER_URL}/payment/fail?transactionId=${transactionId}`,
                cancel_url: 'http://localhost:5000/payment/cancel',
                ipn_url: 'http://localhost:5000/payment/ipn',
                shipping_method: 'Courier',
                product_name: title,
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: customer,
                cus_email: email,
                cus_add1: address,
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: phone,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: postcode,
                ship_country: 'Bangladesh',
            };

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL;
                orderCollection.insertOne({
                    ...order,
                    transactionId,
                    paid: false,
                })
                res.send({ url: GatewayPageURL });
            });
        });

        app.post('/payment/success', async (req, res) => {
            const { transactionId } = req.query;

            if (!transactionId) {
                return res.redirect(`${process.env.CLIENT_URL}/payment/fail`)
            }

            const updatedDoc = {
                $set: {
                    paid: true,
                    paidAt: new Date()
                }
            }
            const result = await orderCollection.updateOne({ transactionId }, updatedDoc);
            if (result.modifiedCount > 0) {
                res.redirect(`${process.env.CLIENT_URL}/payment/success?transactionId=${transactionId}`)
            }
        });

        app.post('/payment/fail', async (req, res) => {
            const { transactionId } = req.query;

            if (!transactionId) {
                return res.redirect(`${process.env.CLIENT_URL}/payment/fail`);
            }

            const result = await orderCollection.deleteOne({ transactionId });
            if (result.deletedCount) {
                res.redirect(`${process.env.CLIENT_URL}/payment/fail`);
            }
        });

        app.get('/order/by-transaction-id/:id', async (req, res) => {
            const { id } = req.params;
            const order = await orderCollection.findOne({ transactionId: id });
            res.send(order);
        });



        app.get('/orders', async (req, res) => {
            let query = {};

            if (req.query.email) {
                query = {
                    email: req.query.email
                }
            }

            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: status
                }
            }
            const result = await orderCollection.updateOne(query, updatedDoc);
            res.send(result);
        });

        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });


    }
    finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Genius car server running');
})

app.listen(port, () => {
    console.log(`Genius car app listening on port ${port}`)
})