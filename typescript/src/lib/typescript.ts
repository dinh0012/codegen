import * as _ from 'lodash'
import { TypeSpec } from '../type';

/**
 * Recursively converts a swagger type description into a typescript type, i.e., a model for our mustache
 * template.
 *
 * Not all type are currently supported, but they should be straightforward to add.
 *
 * @param swaggerType a swagger type definition, i.e., the right hand side of a swagger type definition.
 * @returns a recursive structure representing the type, which can be used as a template model.
 */

export const convertType = (swaggerType, swagger: any = {}): TypeSpec => {
  const typeSpec: TypeSpec = { description: swaggerType.description, isEnum: false };

  if (swaggerType.hasOwnProperty('schema')) {
    return convertType(swaggerType.schema);
  }
  if (_.isString(swaggerType.$ref)) {
    typeSpec.tsType = 'ref';
    typeSpec.target = swaggerType.$ref.substring(
      swaggerType.$ref.lastIndexOf('/') + 1
    );
  } else if (swaggerType.hasOwnProperty('enum')) {
    typeSpec.tsType = swaggerType.enum
      .map((str) => {
        return JSON.stringify(str);
      })
      .join(' | ');
    typeSpec.isAtomic = true;
    typeSpec.isEnum = true;
  } else if (swaggerType.type === 'string') {
    typeSpec.tsType = 'string';
  } else if (swaggerType.type === 'number' || swaggerType.type === 'integer') {
    typeSpec.tsType = 'number';
  } else if (swaggerType.type === 'boolean') {
    typeSpec.tsType = 'boolean';
  } else if (swaggerType.type === 'array') {
    typeSpec.tsType = 'array';
    typeSpec.elementType = convertType(swaggerType.items);
  } else if (swaggerType.type === 'object') {
    // remaining types are created as objects
    if (
      swaggerType.minItems >= 0 &&
      swaggerType.hasOwnProperty('title') &&
      !swaggerType.$ref
    ) {
      typeSpec.tsType = 'any';
    } else {
      typeSpec.tsType = 'object';
      typeSpec.properties = [];
      if (swaggerType.allOf) {
        _.forEach(swaggerType.allOf,  (ref) => {
          if (ref.$ref) {
            const refSegments = ref.$ref.split('/');
            const name = refSegments[refSegments.length - 1];
            _.forEach(swagger.definitions,  (
              definition,
              definitionName
            ) => {
              if (definitionName === name) {
                const property = convertType(definition, swagger);
                Array.prototype.push.apply(
                  typeSpec.properties,
                  property.properties
                );
              }
            });
          } else {
            const property = convertType(ref);
            Array.prototype.push.apply(
              typeSpec.properties,
              property.properties
            );
          }
        });
      }

      _.forEach(swaggerType.properties,  (propertyType, propertyName) => {
        const property = convertType(propertyType);
        property.name = propertyName;

        property.optional = true;
        // propertyのrequiredを見て必須か判断する
        if (
          (swaggerType.required &&
            swaggerType.required.indexOf(propertyName) !== -1) ||
          propertyType.required
        ) {
          property.optional = false;
        }

        typeSpec.properties.push(property);
      });
    }
  } else {
    // type unknown or unsupported... just map to 'any'...
    typeSpec.tsType = 'any';
  }

  // Since Mustache does not provide equality checks, we need to do the case distinction via explicit booleans
  typeSpec.isRef = typeSpec.tsType === 'ref';
  typeSpec.isObject = typeSpec.tsType === 'object';
  typeSpec.isArray = typeSpec.tsType === 'array';
  typeSpec.isAtomic =
    typeSpec.isAtomic ||
    _.includes([ 'string', 'number', 'boolean', 'any' ], typeSpec.tsType);
  return typeSpec;
}
