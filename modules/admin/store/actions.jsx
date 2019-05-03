
import Reflux from 'reflux'

var Actions = Reflux.createActions([
  'toggleMenu',
  "disableRedirect",
  "enableRedirect",
  "showRedirectAlert",
  "hideRedirectAlert",
  "redirectFromAlert"
]);

export default Actions