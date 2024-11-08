

const express = require('express');
const sql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

// const con = sql.createConnection( {
//     host: 'MySQL-8.2',
//     user: 'root',
//     password:'',
//     database: 'test_bd',
// });

const con = sql.createConnection( {
    host: 'autorack.proxy.rlwy.net',
    port: 27638,
    user: 'root',
    password:'GzKKKlhIvFDvDDibmiAAXYNwNnRZERmn',
    database: 'railway',
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

con.connect(err => {
    if(err) console.error('Ошибка подключения:', err);
    else console.log('Working')
});

const PORT = 3306;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads/'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({storage: storage});

let dbData;

con.query('SELECT * FROM Categories', (err, result) => {
    dbData = result;
});

app.post('/', async(req, res) => {
    let data = [req.body.userId, req.body.userEmail, req.body.userName, req.body.userPassword, req.body.userimage];

    con.query('INSERT INTO `Users`(`id`, `email`, `username`, `password`, `userimage`) VALUES (?,?,?,?,?)', data, (err, result) => {
       
        if(err){
            return res.json(err);
        }

        const insertedId = result.insertId;

        con.query('SELECT * FROM Users WHERE id = ?', [insertedId], (err, newUser) => {
            if(err){
                return res.json(err);
            }

            return res.json(newUser);
        });
    });
});

app.post('/uploadimage', upload.single('userimage'), async(req, res) => {
    const {id} = req.body;

    const imagePath = req.file.path.replace(/^.*[\\\/]uploads[\\\/]/, '/uploads/');

    const query = 'UPDATE Users SET userimage = ? WHERE id = ?';

    con.query(query, [imagePath, id], (err, result) => {
        if(err) return res.status(500).send('Failed to upload userimage');

        con.query('SELECT * FROM Users WHERE id = ?', [id], (err, newProfile) => {

            if(err){
                return res.json(err);
            }

            return res.json(newProfile);
        })
    })
});

app.post('/addreview', async(req, res) => {

    let data = [req.body.id, req.body.productid, req.body.userid, req.body.text, req.body.mark];

    con.query('INSERT INTO `Reviews`(`id`, `productid`, `userid`, `text`, `mark`) VALUES (?,?,?,?,?)', data, (err, result) => {
        
        if(err){
            return res.json(err);
        }

        con.query(`SELECT p.id as 'productid', u.id as 'userid', r.id as 'reviewid', u.username, u.userimage, r.text, r.mark FROM Reviews r JOIN Products p on r.productid = p.id JOIN Users u on r.userid = u.id`, (err, result) => {
            if (err) {
                return res.status(500).send('Database query error');
            }

            if (!result || result.length === 0) {
                return res.status(404).send('No data');
            }

            const reviewsData = {};

            result.forEach(row => {
                const { productid, reviewid, username, userid, userimage, text, mark } = row;

                if (!reviewsData[productid]) {
                    reviewsData[productid] = {
                        productid: productid,
                        reviews: {},
                    };
                }

                if (!reviewsData[productid].reviews[reviewid]) {
                    reviewsData[productid].reviews[reviewid] = {
                        userid: userid,
                        username: username,
                        userimage: userimage,
                        text: text,
                        mark: mark,
                    };
                }
            });

            res.json(Object.values(reviewsData));
        });

    })
});

app.get('/users', async(req,res) => {
    con.query('SELECT * FROM Users', (err, result) => {
        return res.send(result);
    })
})

app.get('/categories', async(req,res) => {
    res.send(dbData);
});

app.get('/newarrival', async(req,res) => {

    con.query('SELECT * FROM Products WHERE status = "new"', (err, result) =>{
        res.send(result);
    })
});

let dbProducts;

con.query('SELECT * FROM Products', (err, result) => {
    dbProducts = result;
})

app.get('/products', async(req,res) => {

    const titleFilter = req.query.title;

    if(!titleFilter){
        return res.send(dbProducts);
    }

    const filteredProducts = dbProducts.filter(product => 
        product.title && product.title.toLowerCase().includes(titleFilter.toLowerCase())
    );

    return res.send(filteredProducts);
    
});

app.get('/products/attributes', async (req, res) => {
    con.query('SELECT pa.product_id, pa.attribute_name, pa.attribute_value FROM Products_Attributes pa', (err, result) => {
        res.send(result);
    })
});


const productsCharacteristics = () => {

    app.get('/products/characteristics', async(req, res) => {

        try{
            con.query(`SELECT p.id AS phone_id, p.title AS phone_name, c.name AS characteristic_name, cd.detail_name, cd.detail_info FROM  Products p JOIN  Characteristic_details cd ON p.id = cd.phone_id JOIN  Characteristics c ON c.id = cd.characteristic_id`, (err, result) => {
                
                if(!result || result.length === 0){
                    return res.status(404).send('No data')
                }
    
                const phonesData = {};
    
                result.forEach(row => {
                    const {phone_id, phone_name, characteristic_name, detail_name, detail_info} = row;
    
                    if(!phonesData[phone_id]) {
                        phonesData[phone_id] = {
                            id: phone_id,
                            title: phone_name,
                            characteristics: {},
                        };
                    }

                    if(!phonesData[phone_id].characteristics[characteristic_name]){
                        phonesData[phone_id].characteristics[characteristic_name] = {};
                    }
    
                    phonesData[phone_id].characteristics[characteristic_name][detail_name] = detail_info;
                });

                res.json(Object.values(phonesData))
    
            })
        }
        catch (error){
            if(error.code){
                console.error('MySQL error: ', error)
            }
            else{
                console.error('Not MySQL error: ', error)
                throw error;
            }
        }

        
    })
}

productsCharacteristics();

const productsReviews = () => {
    app.get('/addreview', async (req, res) => {
        try {
            con.query(`SELECT p.id as 'productid', u.id as 'userid', r.id as 'reviewid', u.username, u.userimage, r.text, r.mark FROM Reviews r JOIN Products p on r.productid = p.id JOIN Users u on r.userid = u.id`, (err, result) => {
                if (err) {
                    return res.status(500).send('Database query error');
                }

                if (!result || result.length === 0) {
                    return res.status(404).send('No data');
                }

                const reviewsData = {};

                result.forEach(row => {
                    const { productid, reviewid, username, userimage, userid, text, mark } = row;

                    if (!reviewsData[productid]) {
                        reviewsData[productid] = {
                            productid: productid,
                            reviews: {},
                        };
                    }

                    if (!reviewsData[productid].reviews[reviewid]) {
                        reviewsData[productid].reviews[reviewid] = {
                            userid: userid,
                            username: username,
                            userimage: userimage,
                            text: text,
                            mark: mark,
                        };
                    }
                });

                res.json(Object.values(reviewsData));
            });
        } catch (error) {
            if (error.code) {
                console.error('MySQL error: ', error);
            } else {
                console.error('Not MySQL error: ', error);
                throw error;
            }
        }
    });
};

productsReviews();


const categories = () => {

    var categories = 0;

    con.query('SELECT COUNT(*) as count FROM Categories', (err, result) => {

        
        categories = result[0].count;

        for (let i = 1; i <= categories; i++){
        
            app.get(`/category/${i}/products`, async(req, res) => {
                con.query(`SELECT * FROM PRODUCTS WHERE category = ${i}`, (err, result) => {
                    res.send(result);
                });
        
            });
        }
       
        
    });
    

}


categories();

const productsBrand =() => {

    var categories = 0;

    con.query('SELECT COUNT(*) as count FROM Categories', (err, result) => {


            categories = result[0].count;

            for (let i = 1; i <= categories; i++){
        
                app.get(`/categories/${i}/brands`, async(req, res) => {
                    con.query(`SELECT DISTINCT (brand) FROM Products WHERE category = ${i}`, (err, result) => {
                        res.send(result);
                    });
                });
            }

        
    });
};

productsBrand();

const allProducts = () => {

    var productsCount = 0;

    con.query('SELECT COUNT(*) as count FROM Products', (err, result) => {

            productsCount = result[0].count;

            for(let i = 1; i <= productsCount; i++){
                app.get(`/products/${i}`, async(req, res) => {
                    con.query(`SELECT * FROM Products WHERE id = ${i}`, (err, result) =>{
                        res.send(result);
                    })
                })
            }
        
    })
}

allProducts();

app.listen(PORT, () => {
    console.log('Server start')
});






