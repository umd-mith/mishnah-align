# Mishnah Align

A simple nodejs script to convert Mishnah-Tosefta alignment data from csv to standoff TEI 

## How to use

* Install dependencies by running `nmp i`
* Have eXist running locally with the [Mishanah webapp](https://github.com/umd-mith/mishnah) and [data](https://github.com/umd-mith/mishnah) installed. You may need to update the script `toTEI.js` to point to the correct location.
* Make sure `data.csv` is the latest alignment data.
* Run the script: `node toTEI.js`
* Find the output in the `output` folder