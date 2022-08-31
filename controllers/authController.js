const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');

const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
}

const createSendToken = (user, statusCode, res) => {

    const token = signToken(user._id); 

    const cookieOptions =  {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true 
    };

    if(process.env.NODE_ENV === 'production') cookieOptions.secure = true;

    res.cookie('jwt', token, cookieOptions);

    user.password = undefined;
    

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user
        }
    });

};

exports.signup = catchAsync(async(req, res, next) => {
    
    // const newUser = await User.create({
    //     name: req.body.name,
    //     email: req.body.email,
    //     password: req.body.password,
    //     passwordConfirm: req.body.passwordConfirm,
    //     role: req.body.role,
    //     photo: req.body.photo,
    //     passwordChangedAt: req.body.passwordChangedAt,
    //     passwordResetToken: req.body.passwordResetToken,
    //     passwordResetExpires: req.body.passwordResetExpires
    // });
    
    const newUser = await User.create(req.body);
    const url = `${req.protocol}://${req.get('host')}/me`;
    console.log(url);
    await new Email(newUser, url).sendWelcome();

    createSendToken(newUser, 201, res);
});

exports.login = catchAsync( async (req, res, next) => {
    const {email, password } = req.body;

    if(!email || !password){
        return next(new AppError('please provide email and password', 400));
    }

    const user = await User.findOne({email}).select('+password');

    if(!user || !(await user.correctPassword(password, user.password))){
        return next(new AppError('incorrect email or password', 401));
    }
    createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({status: 'success'});
}

exports.protect = catchAsync(async(req, res, next) => {

    //Getting token and check if it's there

    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }else if(req.cookies.jwt){
        token = req.cookies.jwt;
    }
    if(!token){
        return next(new AppError('You are not logged in! pls log in to get access', 401));
    } 

    //token verification
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    //checking if user still exist
    const currentUser = await User.findById(decoded.id);
    if(!currentUser){
        return next(new AppError('The user belonging token is no longer exist', 401));
    }

    //check if user change password after token was issued
    if(currentUser.changedPasswordAfter(decoded.iat)){
        return next(new AppError('user recently changed password, pls log in again', 401))
    }

    //Grant access to protected routes
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
});

exports.isLoggedIn = async(req, res, next) => {

    if(req.cookies.jwt) {
        token = req.cookies.jwt;
    try {
    
        //token verification
        const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);

        //checking if user still exist
        const currentUser = await User.findById(decoded.id);
        if(!currentUser){
            return next();
        }

        //check if user change password after token was issued
        if(currentUser.changedPasswordAfter(decoded.iat)){
            return next()
        }

        //There is a logged in user
        res.locals.user = currentUser;
            return next();
    } catch(err) {
        return next();
    }
}
next();

};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if(!roles.includes(req.user.role)){
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    }
};

exports.forgotPassword = catchAsync(async(req, res, next) => {
    // Get user based on posted email
    const user = await User.findOne({email: req.body.email});
    if(!user){
        return next(new AppError('There is no user with the email addres', 404));
    }

    //Generate random reset
    const resetToken = user.createPasswordResetToken();
    await user.save({validateBeforeSave: false});

    try{

        //send to user mail
        const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
        await new Email(user, resetURL).sendPasswordReset();

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email'
        });

    } catch(err){
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({validateBeforeSave: false});

        console.log(err);

        return next(new AppError('There was error sending email, try again later'), 500);

    }
    


});

exports.resetPassword = catchAsync(async(req, res, next) => {
    //Get user based on the token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');


    const user = await User.findOne({passwordResetToken: hashedToken, 
    passwordResetExpires: {$gt: Date.now()}});

    //If token has not expire and there is user
    if(!user){
        return next(new AppError('Token is invalid or has expire', 400));
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    createSendToken(user, 200, res);

});

exports.updatePassword = catchAsync(async(req, res, next ) => {

    const user = await User.findById(req.user.id).select('+password');

    if(!(await user.correctPassword(req.body.passwordCurrent, user.password))){
        return next(new AppError('Your current password is wrong.', 401))
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    createSendToken(user, 200, res);

});


