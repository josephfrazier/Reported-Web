/**
 * React Starter Kit (https://www.reactstarterkit.com/)
 *
 * Copyright © 2014-present Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import promisedLocation from 'promised-location';
import humanizeDistance from 'humanize-distance';
import geodist from 'geodist';
import 'intl/locale-data/jsonp/en.js'; // https://github.com/andyearnshaw/Intl.js/issues/271#issuecomment-292233493
import strftime from 'strftime';
import PolygonLookup from 'polygon-lookup';
import geolib from 'geolib';
import d2d from 'degrees-to-direction';

import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './ElectriCitibikes.css';

class ElectriCitibikes extends React.Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
  };

  state = {
    data: {
      features: [],
    },
  };

  componentDidMount() {
    this.pollData();

    fetch(
      'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nybb/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=geojson',
    )
      .then(response => response.json())
      .then(boroughBoundariesFeatureCollection => {
        this.setState({
          boroughBoundariesFeatureCollection,
        });
      });
  }

  pollData = async () => {
    const data = await fetch(
      'https://bikeangels-api.citibikenyc.com/map/v1/nyc/stations',
    ).then(r => r.json());
    console.info({ data });
    await this.updateData({ data });
    const pollInterval = 5000;
    window.setTimeout(this.pollData, pollInterval);
  };

  async updateData({ data }) {
    const updatedAt = Date.now();
    this.setState({ data, updatedAt });

    promisedLocation().then(({ coords: { latitude, longitude } }) =>
      this.setState({ latitude, longitude }),
    );
  }

  render() {
    const {
      state: {
        data,
        latitude,
        longitude,
        updatedAt,
        boroughBoundariesFeatureCollection,
      },
    } = this;
    return (
      <div className={s.root}>
        <div className={s.container}>
          <h1>{this.props.title}</h1>
          <ElectriCitibikeList
            data={data}
            latitude={latitude}
            longitude={longitude}
            updatedAt={updatedAt}
            boroughBoundariesFeatureCollection={
              boroughBoundariesFeatureCollection
            }
          />
        </div>
      </div>
    );
  }
}

function getMapUrl({ station, latitude, longitude }) {
  if (latitude && longitude) {
    return `https://www.google.com/maps/dir/?api=1&travelmode=bicycling&origin=${latitude}%2C${longitude}&destination=${
      station.latitude
    }%2C${station.longitude}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${
    station.latitude
  }%2C${station.longitude}`;
}

export function ElectriCitibikeList({
  data,
  latitude,
  longitude,
  updatedAt,
  boroughBoundariesFeatureCollection,
}) {
  let lookup;
  if (boroughBoundariesFeatureCollection) {
    lookup = new PolygonLookup(boroughBoundariesFeatureCollection);
  }

  const stations = data.features.map(f => {
    const { coordinates } = f.geometry;
    const start = { latitude, longitude };
    const end = {
      latitude: coordinates[1],
      longitude: coordinates[0],
    };
    let dist = 'unknown distance';
    let distMeters;
    let compassBearing;
    if (start.latitude && start.longitude) {
      dist = humanizeDistance(start, end, 'en-US', 'us');
      distMeters = geodist(start, end, { unit: 'meters', exact: true });
      compassBearing = d2d(geolib.getRhumbLineBearing(start, end));
    }

    const boroughPolygon = (lookup &&
      lookup.search(end.longitude, end.latitude)) || {
      properties: {
        BoroName: '(unknown borough)',
      },
    };

    return {
      ...f.properties,
      latitude: end.latitude,
      longitude: end.longitude,
      dist,
      distMeters,
      boroughPolygon,
      compassBearing,
    };
  });

  const ebikeStations = stations.filter(
    station => station.ebikes_available > 0,
  );
  ebikeStations.sort((a, b) => a.distMeters - b.distMeters);
  const humanDate = strftime('%r', new Date(updatedAt));
  const totalEbikesAvailable = ebikeStations
    .map(station => station.ebikes_available)
    .reduce((a, b) => a + b, 0);
  return (
    <>
      {totalEbikesAvailable} available as of {humanDate}
      {ebikeStations.map(station => (
        <details key={station.name} style={{ margin: '1rem 0' }}>
          <summary>
            {station.ebikes_available} @&nbsp;
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={getMapUrl({ station, latitude, longitude })}
            >
              {station.name}, {station.boroughPolygon.properties.BoroName}
            </a>
            <br />
            ({station.dist} {station.compassBearing} from you, about{' '}
            {Math.ceil(station.distMeters / 80)} blocks)
          </summary>
          <ul>
            {station.ebikes &&
              station.ebikes.map(ebike => (
                <li key={ebike.bike_number}>
                  {`#${ebike.bike_number}`} has {ebike.charge}/4 charge
                </li>
              ))}
          </ul>
        </details>
      ))}
    </>
  );
}

export default withStyles(s)(ElectriCitibikes);
