exports.joinTeamRoom = (socket, teamId) => {
  if (!teamId) return;
  socket.join(`team:${teamId}`);
};

exports.leaveTeamRoom = (socket, teamId) => {
  if (!teamId) return;
  socket.leave(`team:${teamId}`);
};

exports.joinMatchRoom = (socket, matchId) => {
  if (!matchId) return;
  socket.join(`match:${matchId}`);
};

exports.leaveMatchRoom = (socket, matchId) => {
  if (!matchId) return;
  socket.leave(`match:${matchId}`);
};
