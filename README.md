simple-vectorizer
==========

リアルタイムでベクタータイルを生成するサーバです。必要最小限のシンプルな実装です。SQLを利用側で指定可能なので様々なデータソースに対応可能です。ここではデータソースの一例として国土地理院のサンプルデータを使いベクタータイル化する方法を説明します。

準備
==========

##### Postgresインストール
```
brew install postgres
```

##### PostGISインストール
```
brew install postgis
```

##### Postgres起動
```
initdb /usr/local/var/postgres -E utf8
pg_ctl start -D /usr/local/var/postgres
```

##### Postgresのユーザ作成
```
createuser -P -s -e honjo
```

##### 空間DB作成
```
createdb gsisample -U honjo
psql -U honjo -d gsisample -c 'create extension postgis'
```

##### 数値地図（国土基本情報）のサンプルデータダウンロード
```
wget http://www.gsi.go.jp/common/000090315.zip
unzip 000090315.zip
```

  > http://www.gsi.go.jp/kibanjoho/kibanjoho40027.html

##### シェープファイルからDBにデータ投入
```
shp2pgsql -W cp932 -D -I -s 4612 ./544022/DKG-SHP-544022-RdCL-20140226-0001.shp RdCL | psql -U honjo -d gsisample
shp2pgsql -W cp932 -D -I -s 4612 ./544022/DKG-SHP-544022-BldA-20140226-0001.shp BldA | psql -U honjo -d gsisample
shp2pgsql -W cp932 -D -I -s 4612 ./544022/DKG-SHP-544022-RailCL-20140226-0001.shp RailCL | psql -U honjo -d gsisample
shp2pgsql -W cp932 -D -I -s 4612 ./544022/DKG-SHP-544022-TrfStrct-20140226-0001.shp TrfStrct | psql -U honjo -d gsisample
```

##### SRIDを4612から3857に変換
```
psql -U honjo -d gsisample -c 'ALTER TABLE rdcl ALTER COLUMN geom TYPE GEOMETRY(MultiLineString,3857) USING ST_Transform(geom,3857)'
psql -U honjo -d gsisample -c 'ALTER TABLE blda ALTER COLUMN geom TYPE GEOMETRY(MultiPolygon,3857) USING ST_Transform(geom,3857)'
psql -U honjo -d gsisample -c 'ALTER TABLE railcl ALTER COLUMN geom TYPE GEOMETRY(MultiLineString,3857) USING ST_Transform(geom,3857)'
psql -U honjo -d gsisample -c 'ALTER TABLE trfstrct ALTER COLUMN geom TYPE GEOMETRY(MultiPolygon,3857) USING ST_Transform(geom,3857)'
```

##### インデックス作成
```
psql -U honjo -d gsisample -c 'CREATE INDEX rdcl_rdctg_idx ON rdcl (rdctg)'
psql -U honjo -d gsisample -c 'CREATE INDEX railcl_ftcode_idx ON rdcl (ftcode)'
psql -U honjo -d gsisample -c 'CREATE INDEX blda_ftcode_idx ON blda (ftcode)'
psql -U honjo -d gsisample -c 'CREATE INDEX trfstrct_idx ON blda (ftcode)'
```

##### データ確認
```
psql -U honjo -d gsisample -c 'select ST_AsText(ST_Transform(geom, 4326)) from rdcl limit 1'
```

##### 関数作成
```
psql -U honjo -d gsisample -c 'create schema map'
psql -U honjo -d gsisample -c 'grant all on schema map to public'
psql -U honjo -d gsisample -f functions.sql
```

実行準備
==========
```
npm install
```

実行
==========
```
node example.js
```

確認
==========
```
open http://localhost:3000/
```
