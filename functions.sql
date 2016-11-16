CREATE OR REPLACE FUNCTION map.tile_to_box(tilex bigint, tiley bigint, tilez integer, pixel integer DEFAULT 0)
  RETURNS geometry AS
$BODY$
DECLARE
scaleFactor double precision = 20037508.342789244;
size integer = 256;
minLon double precision;
maxLon double precision;
minLat double precision;
maxLat double precision;
center double precision;
BEGIN
	tileX := tileX * size;
	tileY := tileY * size;
	center := (size << tileZ) >> 1;

	minLat := ((center - (tileY + size + pixel)) / center) * scaleFactor;
	maxLat := ((center - (tileY - pixel)) / center) * scaleFactor;

	minLon := (((tileX - pixel) - center) / center) * scaleFactor;
	maxLon := (((tileX + size + pixel) - center) / center) * scaleFactor;

	RETURN ST_MakeEnvelope(minLon, minLat, maxLon, maxLat, 3857);
END;
$BODY$
LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION map.pixel_at_zoom(zoom integer)
  RETURNS double precision AS
$BODY$
 SELECT 20037508.342789244 / 256 / (2 ^ $1)
$BODY$
LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION map.safe_intersection(geom_a geometry, geom_b geometry)
  RETURNS geometry AS
$$
BEGIN
    RETURN ST_Intersection(geom_a, geom_b);
    EXCEPTION
        WHEN OTHERS THEN
            BEGIN
                RETURN ST_Intersection(ST_Buffer(geom_a, 0.0000001), ST_Buffer(geom_b, 0.0000001));
                EXCEPTION
                    WHEN OTHERS THEN
                        RETURN ST_GeomFromText('POLYGON EMPTY');
            END;
END
$$
LANGUAGE 'plpgsql' STABLE STRICT;

GRANT EXECUTE ON FUNCTION map.tile_to_box(bigint, bigint, integer, integer) TO public;
GRANT EXECUTE ON FUNCTION map.pixel_at_zoom(integer) TO public;
GRANT EXECUTE ON FUNCTION map.safe_intersection(geometry, geometry) TO public;
