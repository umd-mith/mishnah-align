const fs = require('fs')
const xmldom = require('xmldom')
const csvparse = require('csv-parse')
var request = require('request')
const uuidv4 = require('uuid/v4')

const exist = "http://localhost:8081/exist"

function getTEIDoc(block) {
  return new xmldom.DOMParser().parseFromString(`<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
      <fileDesc>
          <titleStmt>
              <title>Mishnah - Tosefta Alignment - ${block}</title>
          </titleStmt>
          <publicationStmt>
              <p></p>
          </publicationStmt>
          <sourceDesc>
              <p>Generated</p>
          </sourceDesc>
      </fileDesc>
  </teiHeader>
  <text><body><ab></ab></body></text></TEI>`, 'text/xml')
}

function writeTEIFile(teiDoc, block) {
  // Write TEI
  const teiString = new xmldom.XMLSerializer().serializeToString(teiDoc)
  // TODO create output folder if it doesn't exist
  fs.writeFileSync(`output/mtalignment-${block}.xml`, teiString)
  console.log("The TEI file was created.");
}

function generateTEI(refData, refTData, alignData) {

  let teiDoc
  let linkGrp
  let curBlock = ''
  let curBook = 0
  let curChapter = 0
  let curSection = 0

  // Using intermediate pointers to link ranges of words
  // See http://www.tei-c.org/release/doc/tei-p5-doc/en/html/SA.html#SAPTIP

  for (const unit of alignData) {
    // Skip header
    if (unit[0] === '') continue
    
    // Determine if this is a new section
    const groups = unit[1].match(/ref\.((\d+)\.(\d+)\.(\d+))\./)
    const newBlock = groups[1] 
    const newBook = parseInt(groups[2])
    const newChapter = parseInt(groups[3])
    const newSection = parseInt(groups[4])
    // console.log(curBook, newBook, '.', curChapter, newChapter, '.', curSection, newSection)

    if ( curBook < newBook || 
      (curBook === newBook && curChapter < newChapter) ||
      (curBook === newBook && curChapter === newChapter && curSection < newSection) ) {
      // If this is not the very first block, write out TEI
      if (curBook > 0) {
        writeTEIFile(teiDoc, curBlock)
      }
      // Get new TEI doc
      teiDoc = getTEIDoc(newBlock)

      // Create tei:linkGrp for this alignment block
      const containerAb = teiDoc.getElementsByTagName('ab')[0]
      linkGrp = teiDoc.createElementNS('http://www.tei-c.org/ns/1.0', 'linkGrp')
      linkGrp.setAttribute('xml:id', `mt.${newBlock}`)
      containerAb.appendChild(linkGrp)

      // Update current data
      curBlock = newBlock
      curBook = newBook
      curChapter = newChapter
      curSection = newSection
    }

      let baseRangeId = ''
      let compRangeId = ''

      for (const i in unit) {
        const index = parseInt(i)
        const field = unit[i]
        const isBase = index === 1
        const isComp = index === 3
        if (!isBase && !isComp) continue

        const startId = field
        const endId = unit[index + 1]
        // go find in XML
        const lookupData = isBase ? refData : refTData
        const rangeIds = []
        let inRange = false
        for (const w of Array.from(lookupData.getElementsByTagName('w'))) {
          const id = w.getAttribute('xml:id')
          if  (id === startId) {
            rangeIds.push(id)
            inRange = true
          } else if (id === endId) {
            rangeIds.push(id)
            inRange = false
          } else if (inRange) {
            rangeIds.push(id)
          }
        }

        const uid = uuidv4().slice(0, 6)
        if (isBase) baseRangeId = startId + '-' + endId + '-' + uid
        if (isComp) compRangeId = startId + '-' + endId + '-' + uid
        
        // Create intermediary pointer
        const ptr = teiDoc.createElementNS('http://www.tei-c.org/ns/1.0', 'ptr')
        ptr.setAttribute('xml:id', startId + '-' + endId + '-' + uid)
        ptr.setAttribute('target', '#' + rangeIds.join(' #'))
        linkGrp.appendChild(ptr)

        console.log('Created pointer ' + startId + '-' + endId + '-' + uid)
      }

      if (baseRangeId && compRangeId) {
        // Create link between intermediary pointers
        const link = teiDoc.createElementNS('http://www.tei-c.org/ns/1.0', 'link')
        link.setAttribute('target', '#' + baseRangeId + ' ' + '#' + compRangeId)
        linkGrp.appendChild(link)
      }
  }

  // for (const unit of alignData.split('----------------')) {
  //   const lines = unit.split(/[\n\r]/)
  //   if (lines.length < 2) continue

  //   // Determine if this is a new section
  //   const groups = unit.match(/ref\.((\d+)\.(\d+)\.(\d+))\./)
  //   const newBlock = groups[1] 
  //   const newBook = parseInt(groups[2])
  //   const newChapter = parseInt(groups[3])
  //   const newSection = parseInt(groups[4])
  //   console.log(curBook, newBook, '.', curChapter, newChapter, '.', curSection, newSection)
  //   if ( curBook < newBook || 
  //       (curBook === newBook && curChapter < newChapter) ||
  //       (curBook === newBook && curChapter === newChapter && curSection < newSection) ) {
  //     // If this is not the very first block, write out TEI
  //     if (curBook > 0) {
  //       writeTEIFile(teiDoc, curBlock)
  //     }
  //     // Get new TEI doc
  //     teiDoc = getTEIDoc(newBlock)

  //     // Create tei:linkGrp for this alignment block
  //     const containerAb = teiDoc.getElementsByTagName('ab')[0]
  //     linkGrp = teiDoc.createElementNS('http://www.tei-c.org/ns/1.0', 'linkGrp')
  //     linkGrp.setAttribute('xml:id', `mt.${newBlock}`)
  //     containerAb.appendChild(linkGrp)

  //     // Update current data
  //     curBlock = newBlock
  //     curBook = newBook
  //     curChapter = newChapter
  //     curSection = newSection
  //   }

  //   let baseRangeId = ''
  //   let compRangeId = ''

  //   for (const line of lines) {
  //     const isBase = !(line.match(/Base:/) === null)
  //     const isComp = !(line.match(/Comp:/) === null)
  //     if (isBase || isComp) {
  //       const match = line.match(/\[(ref(-t)?.*?)-(ref(-t)?.*?)\]/)
  //       const startId = match[1]
  //       const endId = match[3]
  //       // go find in XML
  //       const lookupData = isBase ? refData : refTData
  //       const rangeIds = []
  //       let inRange = false
  //       for (const w of Array.from(lookupData.getElementsByTagName('w'))) {
  //         const id = w.getAttribute('xml:id')
  //         if  (id === startId) {
  //           rangeIds.push(id)
  //           inRange = true
  //         } else if (id === endId) {
  //           rangeIds.push(id)
  //           inRange = false
  //         } else if (inRange) {
  //           rangeIds.push(id)
  //         }
  //       }

  //       if (isBase) baseRangeId = startId + '-' + endId
  //       if (isComp) compRangeId = startId + '-' + endId
        
  //       // Create intermediary pointer
  //       const ptr = teiDoc.createElementNS('http://www.tei-c.org/ns/1.0', 'ptr')
  //       ptr.setAttribute('xml:id', startId + '-' + endId)
  //       ptr.setAttribute('target', '#' + rangeIds.join(' #'))
  //       linkGrp.appendChild(ptr)

  //       console.log('Created pointer ' + startId + '-' + endId)
  //     }

  //   }
    
  //   if (baseRangeId && compRangeId) {
  //     // Create link between intermediary pointers
  //     const link = teiDoc.createElementNS('http://www.tei-c.org/ns/1.0', 'link')
  //     link.setAttribute('target', '#' + baseRangeId + ' ' + '#' + compRangeId)
  //     linkGrp.appendChild(link)
  //   }
  // }

}

const ref = new Promise((res, rej) => {
  request.get(`${exist}/rest/db/digitalmishnah-tei/mishnah/ref.xml`, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      res(new xmldom.DOMParser().parseFromString(body, 'text/xml'))
    } else {
      console.log(error)
      rej()
    }
  })
})

const reft = new Promise((res, rej) => {
  request.get(`${exist}/rest/db/digitalmishnah-tei/tosefta/ref-t.xml`, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      res(new xmldom.DOMParser().parseFromString(body, 'text/xml'))
    } else {
      console.log(error)
      rej()
    }
  })
})

const align = new Promise((res, rej) => {
  fs.readFile('data.csv', 'utf8', function(err, contents) {
    if (err) {
      console.log(err)
      rej()
    } else {
      csvparse(contents, {}, function(err, output) {
        res(output)
      })
    }
  })  
})

Promise.all([ref, reft, align]).then((res) => {
  generateTEI(...res)
})