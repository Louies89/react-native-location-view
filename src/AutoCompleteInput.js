import React from 'react';
import PropTypes from 'prop-types';
import { TextInput, View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { createIconSet } from 'react-native-vector-icons';
import AutoCompleteListView from './AutoCompleteListView';
import axios, { CancelToken } from 'axios';
import Events from 'react-native-simple-events';
import debounce from '../utils/debounce';

const Icon = createIconSet({"close" : 45}, 'FontName', 'clenet.ttf');
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const REVRSE_GEO_CODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export default class AutoCompleteInput extends React.Component {
  static propTypes = {
    apiKey: PropTypes.string.isRequired,
    language: PropTypes.string,
    debounceDuration: PropTypes.number.isRequired,
    components: PropTypes.arrayOf(PropTypes.string),
  };

  static defaultProps = {
    language: 'en',
    components: [],
  };

  constructor(props) {
    super(props);
    this._request = debounce(this._request.bind(this), this.props.debounceDuration);
  }

  componentWillUnmount() {
    this._abortRequest();
  }

  state = {
    predictions: [],
    loading: false,
    inFocus: false,
    text:''
  };

  _abortRequest = () => {
    if (this.source) {
      this.source.cancel('Operation canceled by the user.');
    }
  };

  fetchAddressForLocation = location => { //This tries to find the address of the loiaction and this service has not been enabled for clenet
    this.setState({ loading: true, predictions: [] });
    let { latitude, longitude } = location;
    this.source = CancelToken.source();
    axios
      .get(`${REVRSE_GEO_CODE_URL}?key=${this.props.apiKey}&latlng=${latitude},${longitude}`, {
        cancelToken: this.source.token,
      })
      .then(({ data }) => {
        this.setState({ loading: false });
        let { results } = data;
        if (results.length > 0) {
          let { formatted_address } = results[0];
          this.setState({ text: formatted_address });
        }
      });
  };

  _request = text => { //Billing happens if user chooses one location suggested by google 
    this._abortRequest();
    if (text.length >= 3) {
      this.source = CancelToken.source();
      axios
        .get(AUTOCOMPLETE_URL, {
          cancelToken: this.source.token,
          params: {
            input: text,
            key: this.props.apiKey,
            language: this.props.language,
            components: this.props.components.join('|'),
            sessiontoken:this.props.getSessiontoken(),
            types:'geocode', //https://developers.google.com/places/web-service/autocomplete#place_types, without this billing shall be more
          },
        })
        .then(({ data }) => {
          // console.log('AUTOCOMPLETE_URL',data)
          let { predictions } = data;
          this.setState({ predictions });
        });
    } else {
      this.setState({ predictions: [] });
    }
  };

  _onChangeText = text => {
    this._request(text);
    this.setState({ text });
  };

  _onFocus = () => {
    this._abortRequest();
    this.setState({ loading: false, inFocus: true });
    Events.trigger('InputFocus');
  };

  _onBlur = () => {
    this.setState({ inFocus: false });
    Events.trigger('InputBlur');
  };

  blur = (description='') => { //description & related logic is added by chandrajyoti
    if(description){
      this.setState({ text: description},()=>{
        this._input.blur();
      });
    }
    else{
      this._input.blur();
    }
  };

  _onPressClear = () => {
    this.setState({ text: '', predictions: [] });
  };

  _getClearButton = () =>
    this.state.inFocus ? (
      <TouchableOpacity style={styles.btn} onPress={this._onPressClear}>
        <Icon name={'close'} style={styles.close} />
      </TouchableOpacity>
    ) : null;

  getAddress = () => (this.state.loading ? '' : this.state.text);

  render() {
    return (
      <Animated.View style={this.props.style}>
        <View style={styles.textInputContainer} elevation={5}>
          <TextInput
            ref={input => (this._input = input)}
            value={this.state.loading ? 'Loading...' : this.state.text}
            style={styles.textInput}
            underlineColorAndroid={'transparent'}
            placeholder={'Search'}
            onFocus={this._onFocus}
            onBlur={this._onBlur}
            onChangeText={this._onChangeText}
            outlineProvider="bounds"
            autoCorrect={false}
            spellCheck={false}
          />
          {this._getClearButton()}
        </View>
        <View style={styles.listViewContainer}>
          <AutoCompleteListView predictions={this.state.predictions} />
        </View>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  textInputContainer: {
    flexDirection: 'row',
    height: 40,
    zIndex: 99,
    paddingLeft: 10,
    borderRadius: 20, //5
    backgroundColor: 'white',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 2,
    shadowOpacity: 0.24,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 15.5,//17
    color: '#404752',
  },
  btn: {
    width: 30,
    height: 30,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listViewContainer: {
    paddingLeft: 3,
    paddingRight: 3,
    paddingBottom: 3,
  },
  close:{fontSize:18,alignSelf:'center',paddingTop:3}
});
