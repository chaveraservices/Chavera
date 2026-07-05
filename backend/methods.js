export const responsedata = (req, res) => {
    res.json({
        success: true,
        message: res.locals.message || 'Success',
        data: res.locals.data || null
    });
};
