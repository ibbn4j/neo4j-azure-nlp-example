# neo4j-azure-nlp-example
Example of building knowledge graph in neo4j using azure nlp.

# Setup
- Install neo4j (http://neo4j.com/download)
- Prepare Azure Cognitive Service key (https://docs.microsoft.com/en-us/azure/cognitive-services/language-service/named-entity-recognition/quickstart?pivots=programming-language-javascript)
- Prepare Azure Computer Vision Service Key (https://docs.microsoft.com/en-us/azure/cognitive-services/computer-vision/quickstarts-sdk/client-library?tabs=visual-studio&pivots=programming-language-javascript)
- Create or update parameters on .env file (and also public/vis.html - TODO: to refactor)
- Install nodejs and dependencies (npm install)

# Running

```
> node ./index.js
Listening at http://localhost:3000
```