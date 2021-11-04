"use strict";

const express = require('express')
const bodyParser = require('body-parser');
const graphBuilder = require('./app')
const app = express()
const port = 3000

app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(`${__dirname}/public`));

app.post('/url', async (req, res) => {
    console.log(`Processing file: ${req.body.getUrl}`);
    await graphBuilder.main(req.body.getUrl);
    console.log(`File has been processed`);
    //res.send('File has been processed! (<a href="javascript:history.back();">back</a>)')
    res.redirect('vis.html')
  })

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})

// graphBuilder.main("https://ibbneo4jstorage.blob.core.windows.net/upload/Neo4j.pdf")