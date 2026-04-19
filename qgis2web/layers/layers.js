var wms_layers = [];


        var lyr_OpenStreetMap_0 = new ol.layer.Tile({
            'title': 'OpenStreetMap',
            'type':'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            })
        });
var format_feeders33_lines_1 = new ol.format.GeoJSON();
var features_feeders33_lines_1 = format_feeders33_lines_1.readFeatures(json_feeders33_lines_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_feeders33_lines_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_feeders33_lines_1.addFeatures(features_feeders33_lines_1);
var lyr_feeders33_lines_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_feeders33_lines_1, 
                style: style_feeders33_lines_1,
                popuplayertitle: 'feeders33_lines',
                interactive: true,
                title: '<img src="styles/legend/feeders33_lines_1.png" /> feeders33_lines'
            });
var format_feeders11_lines_2 = new ol.format.GeoJSON();
var features_feeders11_lines_2 = format_feeders11_lines_2.readFeatures(json_feeders11_lines_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_feeders11_lines_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_feeders11_lines_2.addFeatures(features_feeders11_lines_2);
var lyr_feeders11_lines_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_feeders11_lines_2, 
                style: style_feeders11_lines_2,
                popuplayertitle: 'feeders11_lines',
                interactive: true,
                title: '<img src="styles/legend/feeders11_lines_2.png" /> feeders11_lines'
            });
var format_transmission_stations_3 = new ol.format.GeoJSON();
var features_transmission_stations_3 = format_transmission_stations_3.readFeatures(json_transmission_stations_3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_transmission_stations_3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_transmission_stations_3.addFeatures(features_transmission_stations_3);
cluster_transmission_stations_3 = new ol.source.Cluster({
  distance: 30,
  source: jsonSource_transmission_stations_3
});
var lyr_transmission_stations_3 = new ol.layer.Vector({
                declutter: false,
                source:cluster_transmission_stations_3, 
                style: style_transmission_stations_3,
                popuplayertitle: 'transmission_stations',
                interactive: true,
                title: '<img src="styles/legend/transmission_stations_3.png" /> transmission_stations'
            });
var format_substations_4 = new ol.format.GeoJSON();
var features_substations_4 = format_substations_4.readFeatures(json_substations_4, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_substations_4 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_substations_4.addFeatures(features_substations_4);
cluster_substations_4 = new ol.source.Cluster({
  distance: 30,
  source: jsonSource_substations_4
});
var lyr_substations_4 = new ol.layer.Vector({
                declutter: false,
                source:cluster_substations_4, 
                style: style_substations_4,
                popuplayertitle: 'substations',
                interactive: true,
                title: '<img src="styles/legend/substations_4.png" /> substations'
            });
var format_distribution_substations_5 = new ol.format.GeoJSON();
var features_distribution_substations_5 = format_distribution_substations_5.readFeatures(json_distribution_substations_5, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_distribution_substations_5 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_distribution_substations_5.addFeatures(features_distribution_substations_5);
cluster_distribution_substations_5 = new ol.source.Cluster({
  distance: 30,
  source: jsonSource_distribution_substations_5
});
var lyr_distribution_substations_5 = new ol.layer.Vector({
                declutter: false,
                source:cluster_distribution_substations_5, 
                style: style_distribution_substations_5,
                popuplayertitle: 'distribution_substations',
                interactive: true,
                title: '<img src="styles/legend/distribution_substations_5.png" /> distribution_substations'
            });

lyr_OpenStreetMap_0.setVisible(true);lyr_feeders33_lines_1.setVisible(true);lyr_feeders11_lines_2.setVisible(true);lyr_transmission_stations_3.setVisible(true);lyr_substations_4.setVisible(true);lyr_distribution_substations_5.setVisible(true);
var layersList = [lyr_OpenStreetMap_0,lyr_feeders33_lines_1,lyr_feeders11_lines_2,lyr_transmission_stations_3,lyr_substations_4,lyr_distribution_substations_5];
lyr_feeders33_lines_1.set('fieldAliases', {'id': 'id', 'name': 'name', 'type': 'type', 'level_kv': 'level_kv', 'nameplate_rating': 'nameplate_rating', 'from_name': 'from_name', 'to_name': 'to_name', });
lyr_feeders11_lines_2.set('fieldAliases', {'id': 'id', 'name': 'name', 'type': 'type', 'level_kv': 'level_kv', 'nameplate_rating': 'nameplate_rating', 'from_name': 'from_name', 'to_name': 'to_name', });
lyr_transmission_stations_3.set('fieldAliases', {'id': 'id', 'name': 'name', 'type': 'type', 'level_kv': 'level_kv', });
lyr_substations_4.set('fieldAliases', {'id': 'id', 'name': 'name', 'type': 'type', 'level_kv': 'level_kv', });
lyr_distribution_substations_5.set('fieldAliases', {'id': 'id', 'name': 'name', 'type': 'type', 'level_kv': 'level_kv', 'nameplate_kva': 'nameplate_kva', 'feeder11_id': 'feeder11_id', 'feeder11_name': 'feeder11_name', 'feeder33_id': 'feeder33_id', 'feeder33_name': 'feeder33_name', });
lyr_feeders33_lines_1.set('fieldImages', {'id': '', 'name': '', 'type': '', 'level_kv': '', 'nameplate_rating': '', 'from_name': '', 'to_name': '', });
lyr_feeders11_lines_2.set('fieldImages', {'id': '', 'name': '', 'type': '', 'level_kv': '', 'nameplate_rating': '', 'from_name': '', 'to_name': '', });
lyr_transmission_stations_3.set('fieldImages', {'id': '', 'name': '', 'type': '', 'level_kv': '', });
lyr_substations_4.set('fieldImages', {'id': '', 'name': '', 'type': '', 'level_kv': '', });
lyr_distribution_substations_5.set('fieldImages', {'id': '', 'name': '', 'type': '', 'level_kv': '', 'nameplate_kva': '', 'feeder11_id': '', 'feeder11_name': '', 'feeder33_id': '', 'feeder33_name': '', });
lyr_feeders33_lines_1.set('fieldLabels', {'id': 'no label', 'name': 'no label', 'type': 'no label', 'level_kv': 'no label', 'nameplate_rating': 'no label', 'from_name': 'no label', 'to_name': 'no label', });
lyr_feeders11_lines_2.set('fieldLabels', {'id': 'no label', 'name': 'no label', 'type': 'no label', 'level_kv': 'no label', 'nameplate_rating': 'no label', 'from_name': 'no label', 'to_name': 'no label', });
lyr_transmission_stations_3.set('fieldLabels', {'id': 'no label', 'name': 'no label', 'type': 'no label', 'level_kv': 'no label', });
lyr_substations_4.set('fieldLabels', {'id': 'no label', 'name': 'no label', 'type': 'no label', 'level_kv': 'no label', });
lyr_distribution_substations_5.set('fieldLabels', {'id': 'no label', 'name': 'no label', 'type': 'no label', 'level_kv': 'no label', 'nameplate_kva': 'no label', 'feeder11_id': 'no label', 'feeder11_name': 'no label', 'feeder33_id': 'no label', 'feeder33_name': 'no label', });
lyr_distribution_substations_5.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});