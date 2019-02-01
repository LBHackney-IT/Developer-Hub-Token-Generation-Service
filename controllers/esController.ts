import { APIGatewayProxyHandler, DynamoDBStreamHandler, DynamoDBStreamEvent } from 'aws-lambda';
import { AWSError, Endpoint, DynamoDB } from 'aws-sdk';
import { dbService } from '../services/dbService';
import { IApi } from '../interfaces/IApi';
import { responseService } from '../services/responseService';
import { elasticSearchService } from '../services/elasticSearchService';

export const dynamoDBStreamToEs: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent, context) => {
    try {
        const convert = DynamoDB.Converter.output;
        const esService: elasticSearchService = new elasticSearchService();
        let index: string = process.env.ELASTIC_INDEX_API;
        event.Records.forEach((record) => {
            
            switch (record.eventName) {
                case 'INSERT': {
                    const newObject = convert(record.dynamodb.NewImage);
                    esService.index(newObject, index)
                    .then((data) => {
                        console.log(data);
                    }).catch((error) => {
                        throw new Error(error.message)
                    });
                    break;
                }
                case 'MODIFY': {
                    const newObject = convert(record.dynamodb.NewImage);
                    esService.index(newObject, index)
                    .then((data) => {
                        console.log(data);
                    }).catch((error) => {
                        throw new Error(error.message)
                    });
                    break;
                }
                case 'REMOVE': {
                    const newObject = convert(record.dynamodb.NewImage);
                    esService.delete(newObject, index)
                    .then((data) => {
                        console.log(data);
                    }).catch((error) => {
                        throw new Error(error.message)
                    });
                    break;
                    
                }
            }
        });

        esService.refresh(index);


    } catch (error) {
        console.log({message: error.message, code: error.statusCode});
    }

}