
import Reflux from 'reflux'

var Actions = Reflux.createActions([
  'addInfo',
  'hideInfo',
  'loading',
  'stopLoading',
  'progress',
  'toggleMenu',
  "disableRedirect",
  "enableRedirect",
  "showRedirectAlert",
  "hideRedirectAlert",
  "redirectFromAlert"
]);

export default Actions