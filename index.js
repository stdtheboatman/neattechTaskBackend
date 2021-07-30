// to do
// add dataBase instead Map
// add sms Verify service
// refactor code for more readability

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const cors = require('cors')


const codesDb = new Map()
const refreshTokensDb = new Map()
const app = express()

const timeLiveToken = '2m'
const timeLiveRefreshTokenMs = 60 * 60 * 1000
const timeLiveSmsCodeMs = 60 * 1000

// set size bigger then 63 for security
const secretKey = getRandomString(64, 128)

/*
return random integer in range [l, r)
*/
function getRandomNumber(l, r) {
    return Math.floor(Math.random() * (r - l)) + l
}

/*
return random string with size in range [l, r)
*/
function getRandomString(l, r, alp = 'qwertyuiopasdfghjklzxcvbnm') {
    const size = getRandomNumber(l, r)

    let result = ''
    for (let i = 0; i < size; i++) {
        result += alp[getRandomNumber(0, 26)]
    }

    return result
}

app.use(cors())
app.use(bodyParser.json())
app.use(cookieParser())

app.listen(3000, () => {
    console.log('Server start work at http://localhost:3000')
})

app.get('/', (req, res) => {
    res.status(200).send('welcome to the club boddy')
})

app.post('/sendCode', (req, res) => {
    const {phone} = req.body
    const randomCode = getRandomNumber(1000, 10000)

    console.log(`set to phone: ${phone} code: ${randomCode}`)

    const timeCreated = Date.now()
    codesDb.set(phone, {
        code: randomCode + '',
        timeCreated
    })

    setTimeout(() => {
        if (codesDb.has(phone) && codesDb.get(phone).timeCreated === timeCreated) {
            codesDb.delete(phone)
        }
    }, timeLiveSmsCodeMs)

    res.status(200).send('Code successfully sent')
})

/*
return new jwtToken & refreshToken
*/
function getNewTokens(phone) {
    const jwtToken = jwt.sign({
        phone
    }, secretKey, {
        expiresIn: timeLiveToken
    })

    const newRefreshToken = getRandomString(10, 50)

    const timeCreated = Date.now()
    refreshTokensDb.set(phone, {
        token: newRefreshToken,
        timeCreated
    })

    setTimeout(() => {
        if (refreshTokensDb.has(phone) && refreshTokensDb.get(phone).timeCreated === timeCreated) {
            refreshTokensDb.delete(phone)
        }
    }, timeLiveRefreshTokenMs)

    return {jwtToken, newRefreshToken}
}

app.post('/confirmCode', (req, res) => {
    const {phone, code} = req.body

    if (!codesDb.has(phone)) {
        res.status(400).send('Phone wrong or code expired')
        return
    }

    if (codesDb.get(phone).code !== code) {
        res.status(400).send('Wrong code')
        return
    }

    if (codesDb.get(phone).timeCreated - Date.now() > timeLiveSmsCodeMs) {
        res.status(400).send('Code expired')
        return
    }

    const {jwtToken, newRefreshToken} = getNewTokens(phone)

    res.status(200).cookie('refreshToken', newRefreshToken, {
        httpOnly: true
    }).json(jwtToken)

})

app.post('/refreshToken', (req, res) => {
    console.log(`cookies: ${req.cookies}`)

    const {refreshToken} = req.cookies
    const {phone} = req.body

    if (refreshToken === undefined) {
        res.status(400).send('Can`t find refresh token')
        return
    }

    if (!refreshTokensDb.has(phone)) {
        res.status(400).send('Refresh token expired')
        return
    }

    if (refreshTokensDb.get(phone).token !== refreshToken) {
        res.status(400).send('Wrong refresh token')
        return
    }

    const {jwtToken, newRefreshToken} = getNewTokens(phone)

    res.status(200).cookie('refreshToken', newRefreshToken, {
        httpOnly: true
    }).json(jwtToken)

})

/*

if auth failed
    return undefined
else
    return encoded json from jwt

*/
function auth(req) {
    const {jwtToken} = req.body

    let result = undefined
    try {
        result = jwt.verify(jwtToken, secretKey)
    } catch (e) {
        console.log(e)
    }

    return result
}

app.get('/isAuth', (req, res) => {
    const encodedJwt = auth(req)
    if (encodedJwt === undefined) {
        res.status(401).send('User did`t auth, wrong jwt')
        return
    }

    res.status(400).send('User auth')
})

app.post('/logout', (req, res) => {
    const encodedJwt = auth(req)
    if (encodedJwt === undefined) {
        res.status(401).send('User did`t auth, wrong jwt')
        return
    }

     const {phone} = encodedJwt

    if (refreshTokensDb.has(phone)) {
        refreshTokensDb.delete(phone)
    }

    res.status(200).send('User successful logout')
})