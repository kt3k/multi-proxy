import Forwarder from '../lib/forwarder';
import Promise from 'bluebird';

export default class Proxy {

  constructor(servers, patterns) {
    this.hasMaster = servers.master ? true : false;
    this.servers = servers;
    this.patterns = patterns;
  }

  /**
   * Proxy middleware function to pass request to some destinations
   * if configured pattern matches to destination.
   *
   * @param req
   * @param res
   * @param next
   */
  proxyRequest(req, res, next) {
    if(this.hasMaster) {
      return this.proxyRequestWithMaster(req, res, next);
    }
    return this.proxyRequestWithoutMaster(req, res, next);
  }

  // TODO: Implement proxy with master
  // If servers object has master, the response from this proxy should be the same
  // as master server.
  proxyRequestWithMaster(req, res, next) {
    if (this.isMatchedPattern(req.method, req.url)) {
      const requestToMaster = Forwarder.createSendRequest(req, this.servers.master);
      const requestsToNodes = Forwarder.createSendRequests(req, this.servers.replica);
      Forwarder.sendRequests(requestsToNodes)
        .then(() => {
          requestToMaster.then(responseFromMaster => {
            Proxy.formatHeaders(res, responseFromMaster);
            next();
          });
        })
        .catch((errorResponse) => {
          // TODO: could be better to have an handler or something
          next(new Error(errorResponse));
        });
    }
  }

  proxyRequestWithoutMaster(req, res, next) {
    if (this.isMatchedPattern(req.method, req.url)) {
      const requests = Forwarder.createSendRequests(req, this.servers.replica);
      Forwarder.sendRequests(requests)
        .then(singleResponse => {
          // TODO: could be better
          Proxy.formatHeaders(res, singleResponse);
          next();
        })
        .catch((errorResponse) => {
          // TODO: could be better to have an handler or something
          next(new Error(errorResponse));
        });
    }
  }

  isMatchedPattern(method, path) {
    return this.patterns.some(pattern => {
      return pattern.method === method
          && pattern.path.test(path);
    });
  }

  // TODO: Confirm which header should be overwritten
  static formatHeaders(res, proxyResponse) {
    try {
      // TODO: proxyResponse from master has isMaster as false
      Object.keys(proxyResponse.headers).forEach(key => {
        res.setHeader(key, proxyResponse.headers[key]);
      });
      res.writeHead(proxyResponse.statusCode);
      res.end(proxyResponse.body);
    } catch (error) {
      throw new Error('An Error occured while writing response');
    }
  };
}
