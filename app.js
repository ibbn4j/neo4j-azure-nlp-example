"use strict";
require('dotenv').config()

// ----------------------------------------------------------------------------
// PARAMETERS
// ----------------------------------------------------------------------------

const neo4j_uri = process.env.NEO4J_URI;
const neo4j_user = process.env.NEO4J_USER;
const neo4j_password = process.env.NEO4J_PASSWORD;

const azure_ocr_key = process.env.AZURE_OCR_KEY;
const azure_ocr_endpoint = process.env.AZURE_OCR_ENDPOINT;

const azure_ai_key = process.env.AZURE_AI_KEY;
const azure_ai_endpoint = process.env.AZURE_AI_ENDPOINT;

const STORE_MODE = process.env.STORE_MODE; // apoc | cypher

// ----------------------------------------------------------------------------
// INPUT
// ----------------------------------------------------------------------------

// const docUrl = 'http://www.africau.edu/images/default/sample.pdf';

// ----------------------------------------------------------------------------
// FUNCTIONS
// ----------------------------------------------------------------------------

const sleep = require('util').promisify(setTimeout);
const ComputerVisionClient = require('@azure/cognitiveservices-computervision').ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;
const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");

const textAnalyticsClient = new TextAnalyticsClient(azure_ai_endpoint,  new AzureKeyCredential(azure_ai_key));
const computerVisionClient = new ComputerVisionClient(
    new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': azure_ocr_key } }), azure_ocr_endpoint);
    
const neo4j = require('neo4j-driver')
const driver = neo4j.driver(neo4j_uri, neo4j.auth.basic(neo4j_user, neo4j_password))
// const NeoVis = require('neovis.js') ;    

/**
 * Read text from specified url using Azure  Cognitive Service - Computer Vision
 * 
 * @param {*} computerVisionClient 
 * @param {*} url 
 * @returns 
 */
async function readDocumentFromURL(computerVisionClient, url) {
    log(`-- [AZURE] reading text from doc: ${url}`)

    let result = await computerVisionClient.read(url);
    let operation = result.operationLocation.split('/').slice(-1)[0];
    while (result.status !== 'succeeded') { 
        await sleep(1000);
        result = await computerVisionClient.getReadResult(operation);
    }

    return result.analyzeResult.readResults;
}

/**
 * Recognize entities using Azure Cognitive Service - Text Analytics
 * 
 * @param {*} textAnalyticsClient 
 * @param {*} texts 
 * @returns 
 */
async function entityRecognition(textAnalyticsClient, texts) {
    log(`-- [AZURE] recognize entities...`)
    const entityInputs = Array.isArray(texts) ? texts : [texts];
    return await textAnalyticsClient.recognizeEntities(entityInputs);
}

async function neo4j_store(docUrl, sentences, entityResults) {
    log(`-- [NEO4J] storing entities...`)

    let cypher0 = `MERGE (:Document {Url: '${docUrl}', Body: '${sentences}'});`
    await cypherExecute(cypher0)

    if (STORE_MODE === 'cypher') {
        entityResults.forEach(async sentence => {
            // Keeping the first loop to support future feature extension
            sentence.entities.forEach(async entity => {
                let cypher1 = `MATCH (d:Document {Url: '${docUrl}'})
                                MERGE (c:Category {Name: '${entity.category}'})
                                MERGE (e:Entity {Name: '${entity.text}', Category: '${entity.category}', Subcategory: '${entity.subCategory ? entity.subCategory : "N/A"}', Score: ${entity.confidenceScore}})
                                MERGE (d) - [:HAS_ENTITY] -> (e)
                                MERGE (c) <- [:HAS_CATEGORY] - (e) 
                                MERGE (c) <- [:HAS_CATEGORY] - (d);`;
                await cypherExecute(cypher1)
            })
        });
    } else if (STORE_MODE === 'apoc') {
        let cypher1 = `
            MATCH (d:Document {Url: '${docUrl}'})
            WITH collect(d) AS articles
            CALL apoc.nlp.azure.entities.graph(articles, {
                key: "${azure_ai_key}",
                url: "${azure_ai_endpoint}",
                nodeProperty: "Body",
                writeRelationshipType: "HAS_ENTITY",
                writeRelationshipProperty: "azureEntityScore",
                write: true
            })
            YIELD graph AS g
            RETURN g;
        `
        await cypherExecute(cypher1);
    }
}

async function cypherExecute(cypher){ 
    try {
        const session = await driver.session(/*{database: 'neo4j'}*/)
        await session.run(cypher);
        await session.close()
    } 
    catch (err) {
        console.error(err)
    }
}

async function neo4j_disconnect() {
    await driver.close();
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main(url) {
    const document = await readDocumentFromURL(computerVisionClient, url);
    const sentences = await readTexts(document, true);
    const entityResults = await entityRecognition(textAnalyticsClient, sentences);
    
    // showEntities(entityResults);
    await neo4j_store(url, sentences, entityResults);
    // await neo4j_disconnect();
}

// main();

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Combine parsed text into a single text document
 * 
 * @param {*} document 
 * @param {*} combine 
 * @returns 
 */
 async function readTexts(document, combine) {
    let texts = [];
    for (const page in document) {
      if (document.length > 1) { log(`-- reading page: ${page}`); }
      const result = document[page];
      if (result.lines.length) {
        for (const line of result.lines) {
            texts.push(line.words.map(w => w.text).join(' '))
        }
      }
      else { log('No recognized text.'); }
    }
    return (combine) ? texts.join('\t') : texts;
}

/**
 * Show recognized entities from Azure Name Entity Recognition
 * @param {*} entityResults 
 */
async function showEntities(entityResults) {
    console.log(`ENTITIES=>`);
    entityResults.forEach(document => {
        console.log(`Document ID: ${document.id}`);
        document.entities.forEach(entity => {
            console.log(`\tName: ${entity.text} \tCategory: ${entity.category} \tSubcategory: ${entity.subCategory ? entity.subCategory : "N/A"}`);
            console.log(`\tScore: ${entity.confidenceScore}`);
        });
    });
}

async function log(message) {
    console.log(message)
}

module.exports = {main}