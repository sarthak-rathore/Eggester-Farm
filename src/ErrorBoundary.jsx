import React from "react";
import { FARM } from "./config.js";
/* If one screen breaks, show a calm message instead of a blank page. Technical details go to the browser console only, never on screen. */
export default class ErrorBoundary extends React.Component {
  state = { failed: false, ref: "" };
  static getDerivedStateFromError() { return { failed: true, ref: Math.random().toString(36).slice(2, 8).toUpperCase() }; }
  componentDidCatch(err, info) { console.error("[screen error]", this.state.ref, err, info?.componentStack?.split("\n").slice(0, 4).join("\n")); }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card errbox" role="alert">
        <img className="lg-logo" src={FARM.logo} alt="" width="96" height="80" /><h2>Something went wrong on this screen</h2>
        <p className="muted">Your saved records are safe. Please try again. If it keeps happening, take a screenshot and tell us this code: <b>{this.state.ref}</b></p>
        <div className="row"><button className="btn" onClick={() => this.setState({ failed: false })}>Try again</button><a className="btn ghost" href="#/admin">Go to home</a></div>
      </div>
    );
  }
}
