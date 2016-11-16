var express = require('express');
var Vectorizer = require('./lib/index');
var app = new Vectorizer('postgres://honjo@localhost/gsisample');
app.server.use(express.static('public'));
app.layer('gsisample_layer', function(tile, render) {
    var layers = {};
    layers.rdcl = "SELECT rdctg, ST_AsGeoJSON(ST_Transform(ST_Simplify(ST_LineMerge(ST_Collect(geom)), map.pixel_at_zoom({z})), 4326)) AS geom_geojson FROM (SELECT rdctg, (ST_Dump(map.safe_intersection(geom, map.tile_to_box({x},{y},{z},2)))).geom geom FROM rdcl WHERE geom && map.tile_to_box({x},{y},{z},2)) a GROUP BY a.rdctg";
    layers.railcl = "SELECT ftcode, ST_AsGeoJSON(ST_Transform(ST_Simplify(ST_LineMerge(ST_Collect(geom)), map.pixel_at_zoom({z})), 4326)) AS geom_geojson FROM (SELECT ftcode, (ST_Dump(map.safe_intersection(geom, map.tile_to_box({x},{y},{z},2)))).geom geom FROM railcl WHERE geom && map.tile_to_box({x},{y},{z},2)) a GROUP BY a.ftcode";
    layers.trfstrct = "SELECT ftcode, ST_AsGeoJSON(ST_Transform(ST_Simplify(ST_Union(geom), map.pixel_at_zoom({z})), 4326)) AS geom_geojson FROM (SELECT ftcode, (ST_Dump(map.safe_intersection(geom, map.tile_to_box({x},{y},{z},2)))).geom geom FROM trfstrct WHERE geom && map.tile_to_box({x},{y},{z},2)) a GROUP BY a.ftcode";
    if (tile.z >= 16) {
        layers.blda = "SELECT ftcode, ST_AsGeoJSON(ST_Transform(ST_Simplify(ST_Union(geom), map.pixel_at_zoom({z})), 4326)) AS geom_geojson FROM (SELECT ftcode, (ST_Dump(map.safe_intersection(geom, map.tile_to_box({x},{y},{z},2)))).geom geom FROM blda WHERE geom && map.tile_to_box({x},{y},{z},2)) a GROUP BY a.ftcode";
    }
    render(layers);
});
app.server.listen(3000);