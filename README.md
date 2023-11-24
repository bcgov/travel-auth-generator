# Travel Authorization Form Generator

> [!WARNING]
> This is a proof of concept and is not yet intended for production usage. It is incomplete and requires testing and validation.

## Prerequisites

- Node / NPM (v14.20.0 / 8.19.2 used for development)
- [BC Route Planner API Key](https://api.gov.bc.ca/devportal/api-directory/740?preview=false)
- A blank, editable travel authorization form PDF

## Startup

1. Copy and rename [`.env.sample`](.env.sample) to `.env`. Open `.env` and add your `ROUTE_PLANNER_API_KEY`
2. Add a blank, editable travel authorization form to the project root. Rename this form to `travel-auth-form.pdf`
3. Install node modules using `npm i`
4. Run application using `npm start`
5. Visit home page by opening `http://localhost:3000` in a web browser.

## Usage

### Generating Forms

Once the application is running, you can generate an individual form by filling in travel details. A travel authorization form will be generated with costs automatically calculated and inserted.

You can upload a CSV to generate forms for multiple travelers. Select `Browse...`, select your input .csv, and then select `Upload and Generate` to begin. After some time, a download will begin containing a zip with all TA forms. See the [`travel_auth_sample.csv`](travel_auth_sample.csv) for a sample of how the input .csv should look. You can also use this file for testing.
