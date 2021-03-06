import { APIGatewayProxyHandler} from 'aws-lambda';
import { apiKeyService } from '../services/apiKeyService';
import { allKeysHaveValues } from '../utility/helper';
import { responseService } from '../services/responseService';
import { ICreateKeyRequest, IReadKeyRequest, IVerifyKeyRequest, IAuthoriseKeyRequest } from '../interfaces/IRequests';
import { ApiKey } from '../classes/ApiKey';
import { IKey } from '../interfaces/IKey';

export const createKey: APIGatewayProxyHandler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);

    const createKeyRequest: ICreateKeyRequest = {
      cognitoUsername: body.cognito_username,
      apiId: body.api_id,
      email: body.email,
      stage: body.stage
    }
    if(!allKeysHaveValues(createKeyRequest)) {
      throw new Error('Request variable is missing');
    }
    const apiKey: ApiKey = new ApiKey();
    const response = await apiKey.create(createKeyRequest);
    return responseService.success(response);
  } catch(error) {
    return responseService.error(error.message, error.statusCode);
  }
};

export const readKey: APIGatewayProxyHandler = async (event, context) => {
  try {  
    const body = event.queryStringParameters;
    const readKeyRequest: IReadKeyRequest = {
      cognitoUsername: body.cognito_username,
      apiId: body.api_id,
      stage: body.stage
    }
    if(!allKeysHaveValues(readKeyRequest)) {
      throw new Error('Request variable is missing');
    }
    const apiKey: ApiKey = new ApiKey();
    const response = await apiKey.readSingle(readKeyRequest);
    return responseService.success(response);
  } catch (error) {
      
    return responseService.error(error.message, error.statusCode);
  }  
};

export const readKeysForUser: APIGatewayProxyHandler = async (event, context) => {
  try {
    const pathParameters = event.pathParameters;
    const cognitoUsername: string = pathParameters.cognito_username;

    if(cognitoUsername == null) {
      throw new Error("Request variable is missing");
    }
    const apiKey: ApiKey = new ApiKey();
    const response = await apiKey.readAllForUser(cognitoUsername);
    return responseService.success(response);

  } catch (error) {
    return responseService.error(error.message, error.statusCode);
  }
}

export const readAllUnVerifiedKeys: APIGatewayProxyHandler = async (event, context) => {

  try {
    const apiKey: ApiKey = new ApiKey();
    const response = await apiKey.readAllUnverified();
    return responseService.success(response);
  } catch (error) {
    return responseService.error(error.message , error.statusCode);
  }
}

export const verifyKey: APIGatewayProxyHandler = async (event, context) => {
  try {
    // check user is admin
    const body = JSON.parse(event.body);

    const verifyKeyRequest: IVerifyKeyRequest = {
      cognitoUsername: body.cognito_username,
      apiId: body.api_id,
      stage: body.stage
    }

    if(!allKeysHaveValues(verifyKeyRequest)) {
      throw new Error('Request variable is missing');
    }
    const apiKey: ApiKey = new ApiKey();
    const response = await apiKey.verify(verifyKeyRequest);

    return responseService.success(response);
  } catch (error) {
    
    return responseService.error(error.message, error.statusCode);
  }
}

export const authoriseKey = async (event, context, callback) => {
  try {
    const authoriseKeyRequest: IAuthoriseKeyRequest = {
      apiKey: event.authorizationToken,
      methodArn: event.methodArn,
      apiId: apiKeyService.getApiId(event.methodArn),
      stage: apiKeyService.getStage(event.methodArn)
    };
    if(!allKeysHaveValues(authoriseKeyRequest)) {
      throw new Error("Request variables are missing");
    }
    const apiKey: ApiKey = new ApiKey();
    const policy = await apiKey.authorise(authoriseKeyRequest);
    return policy;
  } catch (error) {
    console.log('error', error);
    callback(error, "unauthorised"); 
  }
}

export const updateLastAccessField = async(event, context, callback) => {
  try {
    const key: IKey = event;

    if(key == null || !key.id) {
      throw new Error('Request variables are missing');
    }
    const apiKey: ApiKey = new ApiKey();
    await apiKey.logRequest(key).then(() => {
      return Promise.all([apiKey.updateLastAccessed(key.id)])
    });
    
    callback(null, 'successsfully updated last accessed field');
  } catch (error) {
    console.log(JSON.stringify(error));
    callback(error);
  }
}