import * as fs from 'fs';
import * as Mustache from 'mustache' ;
import { js_beautify as beautify } from 'js-beautify';
import { JSHINT as lint } from 'jshint';
import * as _ from 'lodash';
import * as ts from './typescript';
import { Data, Method, Option } from '../type';
import { formatPHP } from "../formatCode/format";

const normalizeName = (id) => {
  return id.replace(/\.|\-|\{|\}|\s/g, '_');
};

const capitalize = (text, errorHinting = '') => {
  if (!text) {
    throw new Error(`can't capitalize invalid data : ${ errorHinting }`);
  }
  return text[0].toUpperCase() + text.substring(1)
};

const getPathToMethodName = (opts, m, path) => {
  if (path === '/' || path === '') {
    return m;
  }
  // clean url path for requests ending with '/'
  const cleanPath = path.replace(/\/$/, '');

  let segments = cleanPath.split('/').slice(1);
  segments = _.transform(segments,  (result, segment) => {
    if (segment[0] === '{' && segment[segment.length - 1] === '}') {
      segment =
        'by' +
        segment[1].toUpperCase() +
        segment.substring(2, segment.length - 1);
    }
    result.push(segment);
  });
  const result = _.camelCase(segments.join('-'));
  return m.toLowerCase() + capitalize(result);
};

const getViewForSwagger2 = (opts: Option, type: string) => {
  const swagger = opts.swagger;
  const methods = [];
  const authorizedMethods = [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'COPY',
    'HEAD',
    'OPTIONS',
    'LINK',
    'UNLIK',
    'PURGE',
    'LOCK',
    'UNLOCK',
    'PROPFIND',
  ];
  const data: Data = {
    isNode: type === 'node' || type === 'react',
    isES6: opts.isES6 || type === 'react',
    description: swagger.info.description,
    isSecure: swagger.securityDefinitions !== undefined,
    moduleName: opts.moduleName,
    className: opts.className,
    imports: opts.imports,
    domain:
      swagger.schemes &&
      swagger.schemes.length > 0 &&
      swagger.host &&
      swagger.basePath
        ? swagger.schemes[0] +
        '://' +
        swagger.host +
        swagger.basePath.replace(/\/+$/g, '')
        : '',
    methods: [],
    definitions: [],
  };

  _.forEach(swagger.paths,  (api, path) =>  {
    let globalParams = [];
    /**
     * @param {Object} op - meta data for the request
     * @param {string} m - HTTP method name - eg: 'get', 'post', 'put', 'delete'
     */
    _.forEach(api,  (op, m) => {
      if (m.toLowerCase() === 'parameters') {
        globalParams = op;
      }
    });
    _.forEach(api,  (op, m) => {
      const M = m.toUpperCase();
      if (M === '' || authorizedMethods.indexOf(M) === -1) {
        return;
      }
      const secureTypes = [];
      if (
        swagger.securityDefinitions !== undefined ||
        op.security !== undefined
      ) {
        const mergedSecurity = _.merge([], swagger.security, op.security).map(
           (security) => {
             return Object.keys(security);
           }
        );
        if (swagger.securityDefinitions) {
          for (const sk in swagger.securityDefinitions) {
            if (mergedSecurity.join(',').indexOf(sk) !== -1) {
              secureTypes.push(swagger.securityDefinitions[sk].type);
            }
          }
        }
      }
      let methodName = op.operationId
        ? normalizeName(op.operationId)
        : getPathToMethodName(opts, m, path);
      // Make sure the method name is unique
      if (methods.indexOf(methodName) !== -1) {
        let i = 1;
        while (true) {
          if (methods.indexOf(methodName + '_' + i) !== -1) {
            i++;
          } else {
            methodName = methodName + '_' + i;
            break;
          }
        }
      }
      methods.push(methodName);

      const method: Method = {
        path,
        methodName,
        className: opts.className,
        method: M,
        lowerMethod: m,
        isGET: M === 'GET',
        isPOST: M === 'POST',
        summary: op.description || op.summary,
        capitalizeTag: capitalize(op.tags[0], methodName), // to use controller
        externalDocs: op.externalDocs,
        isSecure: swagger.security !== undefined || op.security !== undefined,
        isSecureToken: secureTypes.indexOf('oauth2') !== -1,
        isSecureApiKey: secureTypes.indexOf('apiKey') !== -1,
        isSecureBasic: secureTypes.indexOf('basic') !== -1,
        parameters: [],
        headers: [],
      };
      if (method.isSecure && method.isSecureToken) {
        data.isSecureToken = method.isSecureToken;
      }
      if (method.isSecure && method.isSecureApiKey) {
        data.isSecureApiKey = method.isSecureApiKey;
      }
      if (method.isSecure && method.isSecureBasic) {
        data.isSecureBasic = method.isSecureBasic;
      }
      const produces = op.produces || swagger.produces;
      if (produces) {
        method.headers.push({
          name: 'Accept',
          value: `'${ produces
            .map((value) => {
              return value;
            })
            .join(', ') }'`,
        });
      }

      const consumes = op.consumes || swagger.consumes;
      if (consumes) {
        method.headers.push({
          name: 'Content-Type',
          value: "'" + consumes + "'",
        });
      }

      let params = [];
      if (_.isArray(op.parameters)) {
        params = op.parameters;
      }
      params = params.concat(globalParams);
      _.forEach(params,  (parameter) => {
        // Ignore parameters which contain the x-exclude-from-bindings extension
        if (parameter['x-exclude-from-bindings'] === true) {
          return;
        }

        // Ignore headers which are injected by proxies & app servers
        // eg: https://cloud.google.com/appengine/docs/go/requests#Go_Request_headers
        if (parameter['x-proxy-header'] && !data.isNode) {
          return;
        }
        if (_.isString(parameter.$ref)) {
          const segments = parameter.$ref.split('/');
          parameter =
            swagger.parameters[segments.length === 1 ? segments[0] : segments[2]
];
        }
        parameter.camelCaseName = _.camelCase(parameter.name);
        if (parameter.enum && parameter.enum.length === 1) {
          parameter.isSingleton = true;
          parameter.singleton = parameter.enum[0];
        }
        if (parameter.in === 'body') {
          parameter.isBodyParameter = true;
        } else if (parameter.in === 'path') {
          parameter.isPathParameter = true;
        } else if (parameter.in === 'query') {
          if (parameter['x-name-pattern']) {
            parameter.isPatternType = true;
            parameter.pattern = parameter['x-name-pattern'];
          }
          parameter.isQueryParameter = true;
        } else if (parameter.in === 'header') {
          parameter.isHeaderParameter = true;
        } else if (parameter.in === 'json') {
          parameter.isJsonParameter = true;
        }

        if (parameter.type === 'string') {
          parameter.isTypeString = true;
        } else if (parameter.type === 'integer') {
          parameter.isTypeInteger = true;
        } else if (parameter.type === 'datestring') {
          parameter.isTypeDateString = true;
        }

        if (parameter.pattern !== null) {
          if (parameter['x-patternErrorMessage']) {
            parameter.patternErrorMessage = parameter['x-patternErrorMessage'];
          } else if (parameter.pattern === '^[a-zA-Z0-9]+$') {
            parameter.patternErrorMessage = '半角英数のみが利用できます';
          } else if (parameter.pattern === '^(?!\\s+$).+$') {
            parameter.patternErrorMessage = '必須項目です';
          } else {
            parameter.patternErrorMessage = `以下の正規表現が利用できます /${
              parameter.pattern
            }/`;
          }
        }

        /* validator向けにmax, min, maxLength, minLength, format などの状態を確認 */
        parameter.tsType = ts.convertType(parameter);
        parameter.cardinality = parameter.required ? '' : '?';
        method.parameters.push(parameter);
      });
      data.methods.push(method);
    });
  });

  _.forEach(swagger.definitions,  (definition, name) => {
    data.definitions.push({
      name,
      description: definition.description,
      tsType: ts.convertType(definition, swagger),
    });
  });

  return data;
};

const getViewForSwagger1 =  (opts, type) => {
  const swagger = opts.swagger;
  const data: Data = {
    isNode: type === 'node' || type === 'react',
    isES6: opts.isES6 || type === 'react',
    description: swagger.description,
    moduleName: opts.moduleName,
    className: opts.className,
    domain: swagger.basePath ? swagger.basePath : '',
    methods: [],
  };
  swagger.apis.forEach((api) => {
    api.operations.forEach((op) => {
      if (op.method === 'OPTIONS') {
        return;
      }
      const method: Method = {
        path: api.path,
        className: opts.className,
        methodName: op.nickname,
        method: op.method,
        isGET: op.method === 'GET',
        isPOST: op.method.toUpperCase() === 'POST',
        summary: op.summary,
        parameters: op.parameters,
        headers: [],
      };

      if (op.produces) {
        const headers: any = { value: [], name: 'Accept' };
        headers.value.push(
          op.produces
            .map((value) => {
              return "'" + value + "'";
            })
            .join(', ')
        );
        method.headers.push(headers);
      }

      op.parameters = op.parameters ? op.parameters : [];
      op.parameters.forEach((parameter) => {
        parameter.camelCaseName = _.camelCase(parameter.name);
        if (parameter.enum && parameter.enum.length === 1) {
          parameter.isSingleton = true;
          parameter.singleton = parameter.enum[0];
        }
        if (parameter.paramType === 'body') {
          parameter.isBodyParameter = true;
        } else if (parameter.paramType === 'path') {
          parameter.isPathParameter = true;
        } else if (parameter.paramType === 'query') {
          if (parameter['x-name-pattern']) {
            parameter.isPatternType = true;
            parameter.pattern = parameter['x-name-pattern'];
          }
          parameter.isQueryParameter = true;
        } else if (parameter.paramType === 'header') {
          parameter.isHeaderParameter = true;
        } else if (parameter.paramType === 'json') {
          parameter.isJsonParameter = true;
        }
      });
      data.methods.push(method);
    });
  });
  return data;
};

const getCode = (opts: Option, type) => {
  // For Swagger Specification version 2.0 value of field 'swagger' must be a string '2.0'
  const data =
    opts.swagger.swagger === '2.0'
      ? getViewForSwagger2(opts, type)
      : getViewForSwagger1(opts, type);
  if (type === 'custom') {
    if (
      !_.isObject(opts.template) ||
      !_.isString(opts.template.class) ||
      !_.isString(opts.template.method)
    ) {
      throw new Error(
        'Unprovided custom template. Please use the following template: template: { class: "...", method: "...", request: "..." }'
      );
    }
  } else {
    if (!_.isObject(opts.template)) {
      opts.template = {};
    }
    const templates = __dirname + '/../templates/';
    opts.template.class =
      opts.template.class ||
      fs.readFileSync(templates + type + '-class.mustache', 'utf-8');
    opts.template.method =
      opts.template.method ||
      fs.readFileSync(
        templates +
        (type === 'typescript' ? 'typescript-' : '') +
        'method.mustache',
        'utf-8'
      );
    if (type === 'typescript') {
      opts.template.type =
        opts.template.type ||
        fs.readFileSync(templates + 'type.mustache', 'utf-8');
    }
  }

  if (opts.mustache) {
    _.assign(data, opts.mustache);
  }

  const source = Mustache.render(opts.template.class, data, opts.template);
  const lintOptions: any = {
    node: type === 'node' || type === 'custom',
    browser: type === 'angular' || type === 'custom' || type === 'react',
    undef: true,
    strict: true,
    trailing: true,
    smarttabs: true,
    maxerr: 999,
  };
  if (opts.esnext) {
    lintOptions.esnext = true;
  }

  if (type === 'typescript') {
    opts.lint = false;
  }

  if (opts.lint === undefined || opts.lint === true) {
    lint(source, lintOptions);
    lint.errors.forEach((error) => {
      if (error.code[0] === 'E') {
        throw new Error(
          error.reason + ' in ' + error.evidence + ' (' + error.code + ')'
        );
      }
    });
  }
  if (opts.beautify === undefined || opts.beautify === true) {
    return beautify(source, { indent_size: 4, max_preserve_newlines: 2 });
  }

  const {format} = opts;
  switch (format) {
    case 'php':
      return formatPHP(source)
    default:
      break;
  }
  return source;

};

export const CodeGen = {
  getTypescriptCode(opts) {
    if (opts.swagger.swagger !== '2.0') {
      throw new Error('Typescript is only supported for Swagger 2.0 specs.');
    }
    return getCode(opts, 'typescript');
  },
  getAngularCode(opts) {
    return getCode(opts, 'angular');
  },
  getNodeCode(opts) {
    return getCode(opts, 'node');
  },
  getReactCode(opts) {
    return getCode(opts, 'react');
  },
  getCustomCode(opts) {
    return getCode(opts, 'custom');
  },
};
