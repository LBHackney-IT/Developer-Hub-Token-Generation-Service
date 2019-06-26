import { dbService } from '../services/dbService';
import { ICreateKeyRequest, IReadKeyRequest, IVerifyKeyRequest, IAuthoriseKeyRequest } from '../interfaces/IRequests';
import { generateID, assignToBody, getStage } from '../utility/helper';
import { apiKeyService } from '../services/apiKeyService';
import { AWSError, Lambda } from 'aws-sdk';
import { IApi } from '../interfaces/IApi';
import { responseService } from '../services/responseService';
import { IKey } from '../interfaces/IKey';
export class ApiKey {
    private API_KEY_STORE_DATABASE_ID = 'apiKey';
    private API_GATEWATE_STORE_DATABASE_ID = 'apiGateway';

    /**
     * This is a function to create an API Key
     *
     * @memberof ApiKey
     */
    create = async (createKeyRequest: ICreateKeyRequest): Promise<object> => {
        try {
            let response;
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);
            // Generate the item to be stored in the db
            const item = {
                // The ID is generated by concatenating the cognitoUsername and apiId
                id: generateID(createKeyRequest.cognitoUsername, createKeyRequest.apiId, createKeyRequest.stage),
                cognitoUsername: createKeyRequest.cognitoUsername,
                apiID: createKeyRequest.apiId,
                email: createKeyRequest.email,
                stage: createKeyRequest.stage,
                apiKey: apiKeyService.create(),
                createdAt: Date.now(),
                verified: false,
                last_accessed: Date.now()
            };

            await db.putItem(item)
                .then((data) => {
                    response = assignToBody({
                        message: 'Your Key has been created'
                    });
                })
                .catch((error: AWSError) => {
                    throw new Error(error.message)
                });
            return response;
        } catch (error) {
            throw new Error(error.message)
        }
    }

    /**
     * This is function to refresh the API token
     *
     * @memberof ApiKey
     */
    refresh = async (createKeyRequest: ICreateKeyRequest) => {
        try {
            let response;
            const id = generateID(createKeyRequest.cognitoUsername, createKeyRequest.apiId, createKeyRequest.stage);
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);

            await db.update(id, {
                apiKey: apiKeyService.create(),
                createdAt: Date.now(),
                last_accessed: Date.now()
            })
                .then((data) => {
                    response = assignToBody({
                        message: 'Your key has been refreshed'
                    });
                })
                .catch((error) => {
                    throw new Error(error.message);
                });
            return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    /**
     * This is a function to update the last_accessed key in dynamoDB
     * after a user attempts to
     *
     * @memberof ApiKey
     */
    updateLastAccessed = async (id) => {
        try {
            let response;
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);

            await db.update(id, {
                last_accessed: Date.now()
            })
                .then((data) => {
                    console.log(data);
                })
                .catch((error) => {
                    console.log(error)
                    throw new Error(error.message);
                });
            // return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }

    /**
     * This is a function to log the request in the apiGateway table
     *
     * @memberof ApiKey
     */
    logRequest = async (key: IKey) => {
        try {
            const db: dbService = new dbService(this.API_GATEWATE_STORE_DATABASE_ID);
            // Test whether it converts to string
            const timeAccessed = Date.now().toString();
            const item = {
                id: `${key.cognitoUsername}_${key.apiID}_${timeAccessed}`,
                cognitoUsername: key.cognitoUsername,
                email: key.email,
                apiID: key.apiID,
                methodType: key.methodType,
                timeAccessed: timeAccessed
            };

            await db.putItem(item)
                .then((data) => {
                    console.log(data);
                }).catch((error) => {
                    console.log(error.message);
                    throw new Error(error.message);
                });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    /**
     * Read a single api for a user, api and stage
     *
     * @memberof ApiKey
     */
    readSingle = async (readKeyRequest: IReadKeyRequest) => {
        try {
            let response;
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);
            const id: string = generateID(readKeyRequest.cognitoUsername, readKeyRequest.apiId, readKeyRequest.stage);

            await db.getItem(id)
                .then((data) => {
                    response = assignToBody({
                        apiKey: data.Item.apiKey,
                        verified: data.Item.verified
                    });
                })
                .catch((error: AWSError) => {
                    throw new Error(error.message);
                });
            return response;
        } catch (error) {
            throw new Error(error.message)
        }
    }

    /**
     * Read all keys for a particular user
     *
     * @memberof ApiKey
     */
    readAllForUser = async (cognitoUsername: string) => {
        try {
            let _response;
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);
            const params = {
                cognitoUsername: cognitoUsername
            };
            await db.scan(params)
                .then((data) => {
                    _response = data.Items;
                })
                .catch((error) => {
                    console.log(error);
                    throw new Error(error.message);
                });

            _response = await Promise.all(_response.map(async (item) => {
                let api: IApi;
                const apiDB: dbService = new dbService("api");
                await apiDB.getItem(item['apiID'])
                    .then((data) => {
                        api = data.Item;
                    })
                    .catch((error) => {
                        throw new Error(error.message);
                    })

                if (api) {
                    return {
                        api: api,
                        apiKey: item['apiKey'],
                        verified: item['verified'],
                        stage: item['stage']
                    }
                } else {
                    return null;
                }
            }));

            _response = _response.filter((item) => {
                return item !== null;
            });

            return responseService.success(_response);
        } catch (error) {
            return responseService.error(error.message, error.statusCode);
        }
    }

    /**
     *
     *
     * @memberof ApiKey
     */
    readAllUnverified = async () => {
        try {
            let response;
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);
            const params = {
                verified: false
            };
            await db.scan(params)
                .then((data) => {
                    // Iterate through the array and restructure the array of objects
                    const items = data.Items.map((item) => {
                        return {
                            email: item['email'],
                            apiID: item['apiID'],
                            verified: item['verified'],
                            cognitoUsername: item['cognitoUsername'],
                            stage: item['stage']
                        };
                    });
                    response = assignToBody(items);
                })
                .catch((error) => {
                    console.log(error);
                });
            return response;
        } catch (error) {
            throw new Error(error.message)
        }
    }

    /**
     * This function set the verified key to true in the apiKey
     *
     * @memberof ApiKey
     */
    verify = async (verifyKeyRequest: IVerifyKeyRequest) => {
        try {
            let response;
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);
            const id: string = generateID(verifyKeyRequest.cognitoUsername, verifyKeyRequest.apiId, verifyKeyRequest.stage);
            const params = {
                verified: true
            };
            await db.update(id, params)
                .then((data) => {
                    response = {
                        body: data.Attributes
                    };
                })
                .catch((error) => {
                    throw new Error(error.message);
                });
            return response;
        } catch (error) {
            throw new Error(error.message)
        }

    }

    /**
     * This function returns a policy depending on the user's permission to access an endpoint by
     * checking whether the apiKey provided is verified. It also invokes the updateLastAccessField function 
     * in the apiKeyController to log the event.
     *
     * @memberof ApiKey
     */
    authorise = async (authoriseKeyRequest: IAuthoriseKeyRequest) => {
        try {
            let policy;
            let key: IKey;
            const db: dbService = new dbService(this.API_KEY_STORE_DATABASE_ID);
            const params = {
                apiKey: authoriseKeyRequest.apiKey,
                apiID: authoriseKeyRequest.apiId,
                stage: authoriseKeyRequest.stage
            };
            authoriseKeyRequest.methodArn = apiKeyService.generateWildCardForResourcePath(authoriseKeyRequest.methodArn);
            // Retrieve objects from DB that match apiKey and apiID
            await db.scan(params).then((data) => {
                key = data.Items[0];
            }).catch((error) => {
                throw new Error(error.message);
            });

            if (key.verified) {
                const lambda = new Lambda({ apiVersion: '2015-03-31' });
                key.methodType = apiKeyService.getMethod(authoriseKeyRequest.methodArn);
                // Update function name to ensure it works independent of stage
                const environmentName = getStage();
                const params = {
                    FunctionName: `token-generator-${environmentName}-update-api-key-last-accessed`,
                    InvocationType: "Event",
                    Payload: JSON.stringify(key)
                };
                // Invoke updateLastAccessField function and pass key object to perform further actions
                await lambda.invoke(params).promise()
                    .then((data) => {
                        console.log(data);
                    })
                    .catch((error) => {
                        console.log(error);
                    });
                // Generate allow policy if key is verified
                policy = apiKeyService.generatePolicy(key.cognitoUsername, "Allow", authoriseKeyRequest.methodArn);
            } else {
                // Generate deny policy if key is verified
                policy = apiKeyService.generatePolicy(key.cognitoUsername, "Deny", authoriseKeyRequest.methodArn);
            }
            return policy;
        } catch (error) {
            console.log(error);
            return apiKeyService.generatePolicy('user', "Deny", authoriseKeyRequest.methodArn)
        }
    }
}