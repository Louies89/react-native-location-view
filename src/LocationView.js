import React from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, Animated, Platform, UIManager, TouchableOpacity, Text, ViewPropTypes } from 'react-native';
import { createIconSet } from 'react-native-vector-icons';
import axios from 'axios';
import Events from 'react-native-simple-events';
import MapView from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service'

const Icon = createIconSet({"map-marker-radius" : 88,"crosshairs-gps":118}, 'FontName', 'clenet.ttf');
import AutoCompleteInput from './AutoCompleteInput';

const PLACE_DETAIL_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const DEFAULT_DELTA = { latitudeDelta: 0.015, longitudeDelta: 0.0121 };

export default class LocationView extends React.Component {
  static propTypes = {
    apiKey: PropTypes.string.isRequired,
    initialLocation: PropTypes.shape({
      latitude: PropTypes.number,
      longitude: PropTypes.number,
    }).isRequired,
    markerColor: PropTypes.string,
    actionButtonStyle: ViewPropTypes.style,
    actionTextStyle: Text.propTypes.style,
    actionText: PropTypes.string,
    onLocationSelect: PropTypes.func,
    debounceDuration: PropTypes.number,
    components: PropTypes.arrayOf(PropTypes.string),
  };

  static defaultProps = {
    markerColor: 'black',
    actionText: 'DONE',
    onLocationSelect: () => ({}),
    debounceDuration: 300,
    components: [],
  };

  constructor(props) {
    super(props);
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental && UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }

  componentDidMount() {
    this.genearteSessionToken();
    Events.listen('InputBlur', this.constructor.displayName, this._onTextBlur);
    Events.listen('InputFocus', this.constructor.displayName, this._onTextFocus);
    Events.listen('PlaceSelected', this.constructor.displayName, this._onPlaceSelected);
    setTimeout(()=>{
      this._getCurrentLocation();
    },300)
    
  }

  componentWillUnmount() {
    Events.rm('InputBlur', this.constructor.displayName);
    Events.rm('InputFocus', this.constructor.displayName);
    Events.rm('PlaceSelected', this.constructor.displayName);
  }

  state = {
    inputScale: new Animated.Value(1),
    inFocus: false,
    region: {
      ...DEFAULT_DELTA,
      ...this.props.initialLocation,
    },
  };

  _animateInput = () => {
    Animated.timing(this.state.inputScale, {
      toValue: this.state.inFocus ? 1.2 : 1,
      duration: 300,
    }).start();
  };

  _onMapRegionChange = region => {
    this._setRegion(region, false);
    if (this.state.inFocus) {
      this._input.blur();
    }
  };

  // _onMapRegionChangeComplete = region => {
  //   this._input.fetchAddressForLocation(region);
  // };

  _onTextFocus = () => {
    this.state.inFocus = true;
    this._animateInput();
  };

  _onTextBlur = () => {
    this.state.inFocus = false;
    this._animateInput();
  };

  _setRegion = (region, animate = true) => {
    // console.log('_setRegion region',region)
    this.state.region = { ...this.state.region, ...region };
    if (animate) this._map.animateToRegion(this.state.region);
  };

  _onPlaceSelected = (result) => {
    // console.log('_onPlaceSelected result',result)
    this._input.blur(result.description); 
    //This shall not be charged as per the link https://developers.google.com/places/web-service/usage-and-billing#places-details-id-refresh
    //as it only wants information using the place_id
    //"You can refresh Place IDs free of charge, by making a Place Details request, specifying only the ID field in the fields parameter." --> https://developers.google.com/places/web-service/place-id#save-id
    this.genearteSessionToken(); //Session token has to be changed once user selects one of the option from auto complete
    axios.get(`${PLACE_DETAIL_URL}?key=${this.props.apiKey}&placeid=${result.placeId}`).then(({ data }) => {
      // console.log('data',data)
      let region = (({ lat, lng }) => ({ latitude: lat, longitude: lng }))(data.result.geometry.location);
      this._setRegion(region);
    });
  };

  _getCurrentLocation = () => {
    // console.log('_getCurrentLocation called')
    // navigator.geolocation.getCurrentPosition(position => {
    //   let location = (({ latitude, longitude }) => ({ latitude, longitude }))(position.coords);
    //   this._setRegion(location);
    // });

    Geolocation.getCurrentPosition(
      (position) => {
          // console.log(position);
          let location = (({ latitude, longitude }) => ({ latitude, longitude }))(position.coords);
          this._setRegion(location);
      },
      (error) => {
          // error.code shall be one of the {PERMISSION_DENIED(1), POSITION_UNAVAILABLE(2), TIMEOUT(3), PLAY_SERVICE_NOT_AVAILABLE(4), SETTINGS_NOT_SATISFIED(5),INTERNAL_ERROR(-1)}
          //Refer error code ...\react-native-geolocation-service\...\LocationError.java
          console.log(error.code, error.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000,showLocationDialog:true }
  );
  };

  onLocationSelect=()=>{
      let address = '';
      if(this._input){
        address = this._input.getAddress();
        if(!address){
          address = '';
        }
      }
      this.props.onLocationSelect({ region:this.state.region, address: address })
  }

  genearteSessionToken=()=>{ //Added by chandrajyoti
    this.sessiontoken = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, a => (a ^ Math.random() * 16 >> a / 4).toString(16)[0]); 
  }

  getSessiontoken=()=>{ //Added by chandrajyoti
    return (this.sessiontoken);
  }

  render() {
    let { inputScale } = this.state;
    return (
      <View style={styles.container}>
        <MapView
          ref={mapView => (this._map = mapView)}
          style={styles.mapView}
          region={this.state.region}
          showsMyLocationButton={true}
          showsUserLocation={true}
          onPress={({ nativeEvent }) => this._setRegion(nativeEvent.coordinate)}
          onRegionChange={this._onMapRegionChange}
          // onRegionChangeComplete={this._onMapRegionChangeComplete} //This service is not enabled for clenet and its not required as it tries to find the address from latitude & longitude
        />
        <Icon
          name={'map-marker-radius'}
          size={30}
          color={this.props.markerColor}
          style={[{ backgroundColor: 'transparent' },this.props.markerStyle]}
        />
        <View style={styles.fullWidthContainer}>
          <AutoCompleteInput
            ref={input => (this._input = input)}
            apiKey={this.props.apiKey}
            style={[styles.input, { transform: [{ scale: inputScale }] }]}
            debounceDuration={this.props.debounceDuration}
            components={this.props.components}
            getSessiontoken={this.getSessiontoken}
          />
        </View>
        <TouchableOpacity activeOpacity={0.8} style={[styles.currentLocBtn, { backgroundColor:'transparent' }]} onPress={this._getCurrentLocation} >
          <Icon name={'crosshairs-gps'} style={[styles.locationIconStyle,this.props.locationIconStyle]} onPress={this._getCurrentLocation}/>
        </TouchableOpacity>
        <View style={styles.actionButtonVw}>
          <TouchableOpacity activeOpacity={0.5} style={[styles.actionButton, this.props.actionButtonStyle]} onPress={this.onLocationSelect} >
              <Text style={[styles.actionText, this.props.actionTextStyle]}>{this.props.actionText}</Text>
          </TouchableOpacity>
        </View>
        {this.props.children()}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapView: {
    ...StyleSheet.absoluteFillObject,
  },
  fullWidthContainer: {
    position: 'absolute',
    width: '100%',
    top: 80,
    alignItems: 'center',
  },
  input: {
    width: '80%',
    padding: 5,
  },
  currentLocBtn: {
    backgroundColor: '#000',
    padding: 5,
    borderRadius: 5,
    position: 'absolute',
    bottom: 70,
    right: 12,
  },
  locationIconStyle:{paddingHorizontal:12,color:'red',fontSize:45},
  actionButtonVw: {
    backgroundColor: 'transparent',
    height: 35,
    position: 'absolute',
    bottom: 22,
    left: 10,
    right: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton:{height: 40,backgroundColor: '#000',borderRadius: 5,alignItems: 'center',justifyContent: 'center',borderRadius:20},
  actionText: {
    color: 'white',
    fontSize: 20,
  },
});
