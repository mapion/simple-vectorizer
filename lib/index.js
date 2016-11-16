var express = require('express');
var async = require('async');
var pg = require('pg');
var SphericalMercator = require('sphericalmercator');
var mapnik = require('mapnik');
var path = require('path');
var zlib = require('zlib');

mapnik.register_datasource(path.join(mapnik.settings.paths.input_plugins, 'geojson.input'));

function headerProtobuf(res) {
    res.set('Content-Type', 'application/x-protobuf');
    res.set('Content-Encoding', 'gzip');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Origin', '*');
}

function stringifyProtobuf(layers, tile) {
    var vtile = new mapnik.VectorTile(tile.z, tile.x, tile.y);
    for (var layerName in layers)
        vtile.addGeoJSON(JSON.stringify(layers[layerName]), layerName);
    return zlib.gzipSync(new Buffer(vtile.getData(), 'binary'));
}

function structureSql(sql, tile, done) {
    var keys = Object.keys(sql);
    async.map(keys, function(item, next) {
        parseSql(sql[item], tile, function(err, out) {
            next(err, out);
        });
    }, function(err, results) {
        var output = {};
        keys.forEach(function(d, i) {
            output[d] = results[i];
        });
        done(err, output);
    });
}

function parseSql(sql, tile, done) {
    sql = sql.replace(/{x}/g, tile.x).replace(/{y}/g, tile.y).replace(/{z}/g, tile.z);
    done(null, sql);
}

function runQuery(structuredSql, tile, req, done) {
    if (structuredSql === false || structuredSql === null) {
        done(null, {});
        return;
    }

    var geojsonLayers = {};
    async.forEach(Object.keys(structuredSql), function(layer, next) {
        sqlToGeojson(structuredSql[layer], tile, req, function(err, geojson) {
            if (err)
                next(err);
            else {
                geojsonLayers[layer] = geojson;
                next();
            }
        });
    }, function(err) {
        if (err)
            done(err);
        else
            done(null, geojsonLayers);
    });
}

function sqlToGeojson(sql, tile, req, done) {
    if (sql === false || sql === null) {
        done(null, {});
        return;
    }

    req.db.query(sql, null, function(sqlError, result) {
        if (sqlError) {
            done([sqlError]);
        } else {
            var geojson = {
                "type": "FeatureCollection",
                "features": []
            };
            result.rows.forEach(function(row) {
                var properties = {};
                for (var attribute in row) {
                    if (attribute !== 'geom_geojson') {
                        properties[attribute] = row[attribute];
                    }
                }
                geojson.features.push({
                    "type": "Feature",
                    "geometry": JSON.parse(row.geom_geojson),
                    "properties": properties
                });
            });
            done(null, geojson);
        }
    });
}

function SimpleVectorizer(dbOptions) {
    this.projection = new SphericalMercator({
        size: 256
    });
    this.dbOptions = dbOptions;
    this.server = express();
    this.server.use(function(req, res, next) {
        req.db = {};
        req.db.query = function(sql, bindvars, callback) {
            pg.connect(dbOptions, function(err, client, done) {
                client.query(sql, bindvars, function(err, result) {
                    callback(err, result);
                    done();
                });
            });
        };
        next();
    });
}

SimpleVectorizer.prototype.layer = function(name, callback) {
    this.server.get('/' + name + '/:z/:x/:y.:ext', function(req, res, throwError) {
        var render = function(data) {
            structureSql(data, tile, function(parsingError, structuredSql) {
                if (parsingError) {
                    render.error(['SQL Parsing Error', parsingError]);
                    return;
                }
                runQuery(structuredSql, tile, req, function(queryError, layers) {
                    if (queryError) {
                        render.error(['Query Error', queryError]);
                    } else {
                        headerProtobuf(res);
                        res.send(stringifyProtobuf(layers, tile));
                    }
                });
            });
        };

        render.error = function(msg) {
            res.send(500);
            throwError((msg instanceof Error) ? msg : new Error(msg));
        };

        if (req.params.ext != 'pbf') {
            render.error('unsupported extension ' + req.params.ext);
            return;
        }

        var tile = {};
        tile.layer = name;
        tile.x = parseInt(req.params.x, 10);
        tile.y = parseInt(req.params.y, 10);
        tile.z = parseInt(req.params.z, 10);

        callback(tile, render);
    });
};

module.exports = SimpleVectorizer;
