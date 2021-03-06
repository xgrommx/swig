var utils = require('../utils');

/**
 * Allows you to import macros from another file directly into your current context.
 * The import tag is specifically designed for importing macros into your template with a specific context scope. This is very useful for keeping your macros from overriding template context that is being injected by your server-side page generation.
 * It is highly recommended to import your macros directly into the template that they will be used in and <strong>not</strong> from the template's parent. Doing so may have unexpected escaping effects.
 *
 * @alias import
 *
 * @example
 * {% import './formmacros.html' as forms %}
 * {{ form.input("text", "name") }}
 * // => <input type="text" name="name">
 *
 * @example
 * {% import "../shared/tags.html" as tags %}
 * {{ tags.stylesheet('global') }}
 * // => <link rel="stylesheet" href="/global.css">
 *
 * @param {string|var}  file      Relative path from the current template file to the file to import macros from.
 * @param {literal}     as        Literally, "as".
 * @param {literal}     varname   Local-accessible object name to assign the macros to.
 */
exports.compile = function (compiler, args, content, parents, options) {
  var ctx = args.pop(),
    out = 'var ' + ctx + ' = {};\n' +
      '(function () {\n' +
      '  var _output = "";\n',
    tokens;

  out += utils.map(args, function (arg) {
    return arg.replace(/__ctx__/g, ctx);
  }).join('');
  out += '}());\n';

  return out;
};

exports.parse = function (str, line, parser, types, stack, opts) {
  var parseFile = require('../swig').parseFile,
    compiler = require('../parser').compile,
    parseOpts = { resolveFrom: opts.filename },
    compileOpts = utils.extend({}, opts, parseOpts),
    macros = [],
    tokens,
    ctx;

  parser.on(types.STRING, function (token) {
    var self = this;
    if (!tokens) {
      tokens = parseFile(token.match.replace(/^("|')|("|')$/g, ''), parseOpts).tokens;
      utils.each(tokens, function (token) {
        var out = '',
          macroName,
          safe;
        if (!token || token.name !== 'macro' || !token.compile) {
          return;
        }
        macroName = token.args[0];
        out += '__ctx__.' + macroName + ' = ' + token.compile(compiler, token.args, token.content, [], compileOpts);
        safe = macroName + '\\.safe ';
        out = out.replace(new RegExp(safe), '__ctx__.' + safe.replace(/\\/g, ''));
        macros.push(macroName);
        self.out.push(out);
      });
      return;
    }

    throw new Error('Unexpected string ' + token.match + ' on line ' + line + '.');
  });

  parser.on(types.VAR, function (token) {
    var self = this;
    if (!tokens || ctx) {
      throw new Error('Unexpected variable "' + token.match + '" on line ' + line + '.');
    }

    if (token.match === 'as') {
      return;
    }

    ctx = token.match;
    self.out.push(ctx);
    utils.each(macros, function (macro) {
      self.macros.push(ctx + '.' + macro);
    });

    return false;
  });

  return true;
};

exports.block = true;
